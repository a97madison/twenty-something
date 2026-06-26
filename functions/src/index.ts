/**
 * Callable Cloud Functions — the server-side scoring authority.
 *
 *   submitDaily       → verify a daily-challenge solution, update streak.
 *   submitRoomSolution → verify a room solution, award the point to the FIRST
 *                        solver via a transaction.
 *
 * Both share verifySubmission(). Neither trusts client-sent cards/targets; the
 * puzzle is always rebuilt from the server's stored document.
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore, FieldValue, Timestamp } from "firebase-admin/firestore";
import { initializeApp } from "firebase-admin/app";

import { formatExpr, isWellFormedExpr, type Variant } from "@twenty-something/core";
import { verifySubmission } from "./verify.ts";
import { applySolve, deriveSolveTimeSec, sanitizeAttempts, type StreakState } from "./streak.ts";
import {
  isDateKey,
  dailyFieldKey,
  validateRating,
  computePercentile,
} from "./percentile.ts";
import type { DailyPuzzleDoc, UserDoc, RoomDoc, RoomRoundDoc } from "./model.ts";
import { dealSolvableRound, makeRoomCode, sanitizeWinningScore, sanitizeDuration } from "./rooms.ts";
import { buildExpoPushMessage, challengeResultPush, isExpoPushToken, type ChallengeResult } from "./push.ts";

initializeApp();
const db = getFirestore();

/** Shared shape of what the client sends. */
interface SubmitInput {
  expr: unknown; // untrusted expression tree
  // daily:
  date?: string;
  solveTimeSec?: number;
  attempts?: number;
  // room:
  roomId?: string;
  roundNumber?: number;
}

/** Require an authenticated caller; return their uid. */
function requireUid(auth: { uid: string } | undefined): string {
  if (!auth?.uid) {
    throw new HttpsError("unauthenticated", "Sign-in required to submit.");
  }
  return auth.uid;
}

// --------------------------------------------------------------------------
// Daily challenge
// --------------------------------------------------------------------------

export const submitDaily = onCall<SubmitInput>(async (request) => {
  const uid = requireUid(request.auth);
  const { expr, date, attempts } = request.data;

  if (typeof date !== "string" || !isWellFormedExpr(expr)) {
    throw new HttpsError("invalid-argument", "Missing or malformed submission.");
  }

  const puzzleSnap = await db.doc(`dailyPuzzles/${date}`).get();
  if (!puzzleSnap.exists) {
    throw new HttpsError("not-found", "No puzzle for that date.");
  }
  const puzzle = puzzleSnap.data() as DailyPuzzleDoc;

  // Verify against the SERVER's puzzle, not anything the client claimed.
  const verdict = verifySubmission(puzzle, expr);
  if (!verdict.ok) {
    // A correct-but-wrong submission is a normal game outcome, not an error;
    // return it as data so the app can show "not quite".
    return { solved: false, reason: verdict.reason };
  }

  // Update streak + write the result atomically, idempotent per (uid, date).
  const userRef = db.doc(`users/${uid}`);
  const resultRef = db.doc(`users/${uid}/dailyResults/${date}`);

  const outcome = await db.runTransaction(async (tx) => {
    const userSnap = await tx.get(userRef);
    const prior: StreakState = userSnap.exists
      ? {
          currentStreak: (userSnap.data() as UserDoc).currentStreak ?? 0,
          maxStreak: (userSnap.data() as UserDoc).maxStreak ?? 0,
          lastPlayedDate: (userSnap.data() as UserDoc).lastPlayedDate ?? null,
        }
      : { currentStreak: 0, maxStreak: 0, lastPlayedDate: null };

    const { next, counted } = applySolve(prior, date);

    if (counted) {
      tx.set(
        userRef,
        {
          currentStreak: next.currentStreak,
          maxStreak: next.maxStreak,
          lastPlayedDate: next.lastPlayedDate,
          totalSolved: FieldValue.increment(1),
        },
        { merge: true },
      );
      tx.set(resultRef, {
        date,
        solved: true,
        // Derived from the server's publish time — the client's reported
        // solveTimeSec is ignored, so a time-based leaderboard can't be spoofed.
        solveTimeSec: deriveSolveTimeSec(puzzle.publishedAt.toMillis(), Date.now()),
        attempts: sanitizeAttempts(attempts),
        expression: formatExpr(expr),
        completedAt: Timestamp.now(),
      });
      // Aggregate stats for "X% solved today" social proof.
      tx.set(
        puzzleSnap.ref,
        { stats: { totalSolved: FieldValue.increment(1) } },
        { merge: true },
      );
    }
    return next;
  });

  return {
    solved: true,
    currentStreak: outcome.currentStreak,
    maxStreak: outcome.maxStreak,
  };
});

// --------------------------------------------------------------------------
// Daily game — submit a finished game's rating, get the field percentile
// --------------------------------------------------------------------------
//
// The redesigned single-player daily: everyone plays the SAME N hands for a
// date (dealt offline + deterministically by the game engine), then submits the
// game's composite star RATING. The server records it and ranks it against
// everyone who played that date+variant. See percentile.ts for the trust caveat
// (the rating is client-measured; the percentile is social, not anti-cheat).

interface DailyGameResultInput {
  date?: unknown;
  variant?: unknown;
  rating?: unknown;
}

const VARIANTS = new Set<Variant>(["24", "20_something"]);

export const submitDailyGameResult = onCall<DailyGameResultInput>(async (request) => {
  const uid = requireUid(request.auth);
  const { date, variant, rating } = request.data;

  if (!isDateKey(date) || !VARIANTS.has(variant as Variant)) {
    throw new HttpsError("invalid-argument", "Missing or malformed daily result.");
  }
  const v = validateRating(rating);
  if (!v.ok) {
    throw new HttpsError("invalid-argument", v.reason);
  }

  const playersCol = db
    .doc(`dailyGameFields/${dailyFieldKey(date, variant as Variant)}`)
    .collection("players");
  const myRef = playersCol.doc(uid);

  // First submit wins: a player's daily rating LOCKS on first submit, so a
  // replay can't fish for a better score. Returns the effective (locked) rating.
  const myRating = await db.runTransaction(async (tx) => {
    const mine = await tx.get(myRef);
    if (mine.exists) return (mine.data() as { rating: number }).rating;
    tx.set(myRef, {
      rating: v.rating,
      variant,
      date,
      submittedAt: Timestamp.now(),
    });
    return v.rating;
  });

  // Rank against the whole field for this date+variant. Reading every player doc
  // per submit is O(field) — fine at this scale; swap in a histogram aggregate
  // if a day's field ever grows large.
  const snap = await playersCol.get();
  const field = snap.docs.map((d) => (d.data() as { rating: number }).rating);
  const percentile = computePercentile(field, myRating);

  return { rating: myRating, percentile, fieldSize: field.length };
});

// --------------------------------------------------------------------------
// Online room — first valid solve wins
// --------------------------------------------------------------------------

export const submitRoomSolution = onCall<SubmitInput>(async (request) => {
  const uid = requireUid(request.auth);
  const { expr, roomId, roundNumber } = request.data;

  if (
    typeof roomId !== "string" ||
    typeof roundNumber !== "number" ||
    !isWellFormedExpr(expr)
  ) {
    throw new HttpsError("invalid-argument", "Missing or malformed submission.");
  }

  const roundRef = db.doc(`rooms/${roomId}/rounds/${roundNumber}`);
  const roomRef = db.doc(`rooms/${roomId}`);
  const playerRef = db.doc(`rooms/${roomId}/players/${uid}`);

  // The transaction is what makes "first" fair: two near-simultaneous valid
  // solves serialize; the first commits winnerId, the second sees it's taken.
  const result = await db.runTransaction(async (tx) => {
    // Read everything we may write to BEFORE any writes (Firestore requirement).
    const roundSnap = await tx.get(roundRef);
    if (!roundSnap.exists) {
      throw new HttpsError("not-found", "Round not found.");
    }
    const round = roundSnap.data() as RoomRoundDoc;

    // Round already decided or timed out — reject before doing work.
    if (round.status !== "racing") {
      return { won: false, reason: "round_over" as const };
    }
    if (round.endsAt && round.endsAt.toMillis() < Date.now()) {
      tx.update(roundRef, { status: "expired" });
      return { won: false, reason: "expired" as const };
    }

    // Verify against the server's stored round puzzle.
    const verdict = verifySubmission(round, expr);
    if (!verdict.ok) {
      return { won: false, reason: verdict.reason };
    }

    // Valid AND first. Read room + player to resolve the match state atomically.
    const roomSnap = await tx.get(roomRef);
    const playerSnap = await tx.get(playerRef);
    const room = roomSnap.data() as RoomDoc | undefined;
    const winningScore = room?.config?.winningScore ?? Infinity;
    const newScore = ((playerSnap.data()?.score as number | undefined) ?? 0) + 1;
    const matchWon = newScore >= winningScore;

    tx.update(roundRef, { status: "solved", winnerId: uid });
    tx.set(playerRef, { score: newScore }, { merge: true });
    if (matchWon) {
      tx.update(roomRef, { status: "finished" });
    }
    // Next-round dealing is intentionally NOT here: it needs server-side hand
    // generation + solvability check (its own function). This resolves the
    // round and the match; a separate dealNextRound advances play.
    return { won: true, matchWon, score: newScore, expression: formatExpr(expr) };
  });

  return result;
});

// --------------------------------------------------------------------------
// Live rooms — lobby / join / deal a round. submitRoomSolution (above) scores
// each round: first valid solve wins. These three set the table for it.
// --------------------------------------------------------------------------

interface CreateRoomInput {
  variant?: unknown;
  winningScore?: unknown;
}

export const createRoom = onCall<CreateRoomInput>(async (request) => {
  const uid = requireUid(request.auth);
  const variant = request.data.variant;
  if (!VARIANTS.has(variant as Variant)) {
    throw new HttpsError("invalid-argument", "Unknown variant.");
  }
  const winningScore = sanitizeWinningScore(request.data.winningScore);

  // Allocate a short code that isn't already live (collisions are rare).
  let roomId = "";
  for (let i = 0; i < 6; i++) {
    const candidate = makeRoomCode(Math.random);
    if (!(await db.doc(`rooms/${candidate}`).get()).exists) {
      roomId = candidate;
      break;
    }
  }
  if (!roomId) throw new HttpsError("resource-exhausted", "Couldn't allocate a room code.");

  await db.doc(`rooms/${roomId}`).set({
    status: "lobby",
    hostId: uid,
    variant,
    config: { winningScore },
    createdAt: Timestamp.now(),
  });
  await db.doc(`rooms/${roomId}/players/${uid}`).set({ score: 0, joinedAt: Timestamp.now() });
  return { roomId, variant, winningScore };
});

interface JoinRoomInput {
  roomId?: unknown;
}

export const joinRoom = onCall<JoinRoomInput>(async (request) => {
  const uid = requireUid(request.auth);
  const roomId = typeof request.data.roomId === "string" ? request.data.roomId.toUpperCase() : "";
  const snap = await db.doc(`rooms/${roomId}`).get();
  if (!snap.exists) throw new HttpsError("not-found", "Room not found.");
  const room = snap.data() as RoomDoc;
  if (room.status === "finished") throw new HttpsError("failed-precondition", "That match is over.");

  await db.doc(`rooms/${roomId}/players/${uid}`).set({ score: 0, joinedAt: Timestamp.now() }, { merge: true });
  return { roomId, variant: room.variant, winningScore: room.config.winningScore, status: room.status };
});

interface DealRoundInput {
  roomId?: unknown;
  roundNumber?: unknown;
  durationSec?: unknown;
}

export const dealRoomRound = onCall<DealRoundInput>(async (request) => {
  const uid = requireUid(request.auth);
  const roomId = typeof request.data.roomId === "string" ? request.data.roomId.toUpperCase() : "";
  const roundNumber = request.data.roundNumber;
  if (typeof roundNumber !== "number" || !Number.isInteger(roundNumber) || roundNumber < 1) {
    throw new HttpsError("invalid-argument", "Bad round number.");
  }
  const roomRef = db.doc(`rooms/${roomId}`);
  const snap = await roomRef.get();
  if (!snap.exists) throw new HttpsError("not-found", "Room not found.");
  const room = snap.data() as RoomDoc;
  // Only the host deals — keeps two clients from racing to create the round.
  if (room.hostId !== uid) throw new HttpsError("permission-denied", "Only the host can deal.");

  const round = dealSolvableRound(room.variant, Math.random);
  const durationSec = sanitizeDuration(request.data.durationSec);
  const endsAt = durationSec ? Timestamp.fromMillis(Date.now() + durationSec * 1000) : null;

  await db.doc(`rooms/${roomId}/rounds/${roundNumber}`).set({
    roundNumber,
    cards: round.cards,
    target: round.target,
    operations: round.operations,
    status: "racing",
    startedAt: Timestamp.now(),
    endsAt,
    winnerId: null,
  });
  await roomRef.update({ status: "in_progress" });
  return {
    roundNumber,
    cards: round.cards,
    target: round.target,
    operations: round.operations,
    endsAt: endsAt ? endsAt.toMillis() : null,
  };
});

// --------------------------------------------------------------------------
// Social push — the only nudge that needs a server (no device knows when your
// friend accepts your offline challenge). Register a token keyed by the stable
// playerId the challenge code carries; the accepter reports the result; we push.
// --------------------------------------------------------------------------

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

interface RegisterTokenInput {
  playerId?: unknown;
  token?: unknown;
}

export const registerPushToken = onCall<RegisterTokenInput>(async (request) => {
  const uid = requireUid(request.auth);
  const { playerId, token } = request.data;
  if (typeof playerId !== "string" || !playerId || !isExpoPushToken(token)) {
    throw new HttpsError("invalid-argument", "Bad token registration.");
  }
  // Keyed by playerId (what the challenge code carries); uid stored for audit.
  await db.doc(`pushTokens/${playerId}`).set({ token, uid, updatedAt: Timestamp.now() }, { merge: true });
  return { ok: true };
});

interface ReportResultInput {
  challengerPlayerId?: unknown;
  result?: unknown;
  accepterName?: unknown;
}

const RESULTS = new Set<ChallengeResult>(["win", "loss", "tie"]);

export const reportChallengeResult = onCall<ReportResultInput>(async (request) => {
  requireUid(request.auth);
  const { challengerPlayerId, result, accepterName } = request.data;
  if (typeof challengerPlayerId !== "string" || !RESULTS.has(result as ChallengeResult)) {
    throw new HttpsError("invalid-argument", "Bad result report.");
  }
  const snap = await db.doc(`pushTokens/${challengerPlayerId}`).get();
  if (!snap.exists) return { sent: false }; // challenger never registered for push
  const token = (snap.data() as { token: string }).token;
  const { title, body } = challengeResultPush(typeof accepterName === "string" ? accepterName : "", result as ChallengeResult);
  const message = buildExpoPushMessage(token, title, body, { kind: "challenge_result" });
  try {
    await fetch(EXPO_PUSH_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(message),
    });
  } catch {
    return { sent: false };
  }
  return { sent: true };
});
