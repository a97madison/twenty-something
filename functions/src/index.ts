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

import { formatExpr, isWellFormedExpr } from "@twenty-something/core";
import { verifySubmission } from "./verify.ts";
import { applySolve, deriveSolveTimeSec, sanitizeAttempts, type StreakState } from "./streak.ts";
import type { DailyPuzzleDoc, UserDoc, RoomDoc, RoomRoundDoc } from "./model.ts";

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
