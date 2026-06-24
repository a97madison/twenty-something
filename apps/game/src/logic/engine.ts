/**
 * Offline game engine — pure, UI-free, fully node-testable.
 *
 * Everything the single-player game needs that ISN'T rendering: dealing a
 * guaranteed-solvable hand, speed-based scoring, the streak rules, and
 * local-record persistence. No React, no React Native, no Date.now / Math.random
 * inside the transitions — `now` and `rng` are injected, so every function is
 * deterministic and unit-testable the way core/functions are.
 *
 * This is deliberately ONE module with no relative imports (only the core
 * package). In step 3 Metro bundles this source, and Metro rejects `.ts` import
 * extensions while node's test runner requires them — keeping the engine
 * self-contained avoids that conflict (tests import `./engine.ts`; the screens
 * reach it through an extensionless barrel).
 *
 * Correctness is NOT re-implemented here: a submitted solution is judged by
 * core's `validateSolution`, the same cheat-proof authority the server uses, so
 * the streak only advances on a genuinely correct answer.
 */

import {
  validateSolution,
  computeTarget,
  isSolvable,
  CLASSIC_OPERATIONS,
  type Expr,
  type Hand,
  type Variant,
  type ValidationError,
} from "@twenty-something/core";

// ---------------------------------------------------------------------------
// Dealing
// ---------------------------------------------------------------------------

/** A source of randomness in [0, 1). Injected so deals are deterministic in tests. */
export type Rng = () => number;

/** A dealt hand: cosmetic values/suits plus the typed core hand and its target. */
export interface DealtHand {
  /** Four card values, A–K = 1–13, in flip order (index 3 = last-flipped). */
  values: number[];
  /** Four suit indices 0–3 — purely cosmetic, never used in arithmetic. */
  suits: number[];
  /** The typed core hand with stable ids c0–c3. */
  hand: Hand;
  /** The number to reach, computed for the variant. */
  target: number;
}

const CARD_COUNT = 4;
const VALUE_RANGE = 13; // A..K
const SUIT_RANGE = 4;
const MAX_DEAL_ATTEMPTS = 1000;

function buildHand(values: number[]): Hand {
  return [
    { id: "c0", value: values[0]! },
    { id: "c1", value: values[1]! },
    { id: "c2", value: values[2]! },
    { id: "c3", value: values[3]! },
  ];
}

/**
 * Deal a hand GUARANTEED solvable for the variant. Re-rolls until core's solver
 * confirms a solution exists, so the game never deals a dead hand. Solvable
 * hands are overwhelmingly common, so this almost always succeeds on the first
 * try; the attempt cap is a safety valve against a pathological rng.
 */
export function dealSolvableHand(variant: Variant, rng: Rng = Math.random): DealtHand {
  for (let attempt = 0; attempt < MAX_DEAL_ATTEMPTS; attempt++) {
    const values = Array.from({ length: CARD_COUNT }, () => 1 + Math.floor(rng() * VALUE_RANGE));
    const suits = Array.from({ length: CARD_COUNT }, () => Math.floor(rng() * SUIT_RANGE));
    const hand = buildHand(values);
    const target = computeTarget(variant, hand);
    if (isSolvable({ hand, target, operations: CLASSIC_OPERATIONS })) {
      return { values, suits, hand, target };
    }
  }
  throw new Error(`dealSolvableHand: no solvable hand in ${MAX_DEAL_ATTEMPTS} attempts`);
}

// ---------------------------------------------------------------------------
// Scoring (scaled by speed; never a fail condition)
// ---------------------------------------------------------------------------

/** Points for an instant solve. */
export const BASE_SCORE = 1000;
/** Points shed per second of solving. */
export const PENALTY_PER_SEC = 10;
/** A solve never scores below this — a slow solve still counts, it just earns less. */
export const MIN_SCORE = 100;

/**
 * Score for a single solve, scaled by speed. Linear decay from BASE_SCORE down
 * to a MIN_SCORE floor: the timer lowers your score but, by design, can never
 * zero it out or break a streak. Negative elapsed (clock skew) is clamped to 0.
 */
export function solveScore(elapsedMs: number): number {
  const seconds = Math.max(0, elapsedMs) / 1000;
  const raw = Math.round(BASE_SCORE - PENALTY_PER_SEC * seconds);
  return Math.max(MIN_SCORE, Math.min(BASE_SCORE, raw));
}

// ---------------------------------------------------------------------------
// Game state + transitions
// ---------------------------------------------------------------------------

/** Persisted personal bests. Survive across runs via the KeyValueStore. */
export interface Records {
  /** Longest streak ever reached. */
  bestStreak: number;
  /** Fastest single solve in ms, or null until the first solve. */
  bestTimeMs: number | null;
}

export const EMPTY_RECORDS: Records = { bestStreak: 0, bestTimeMs: null };

/** The whole offline game state. Plain data — no methods, no UI. */
export interface GameState {
  variant: Variant;
  /** The hand currently being solved. */
  current: DealtHand;
  /** Timestamp (ms) the current hand was dealt — scoring measures from here. */
  handStartedAt: number;
  /** Consecutive solves without a pass. */
  streak: number;
  /** Running total this run. */
  score: number;
  /** Personal bests (loaded from storage, updated on solve). */
  records: Records;
}

/** Start a fresh run: deal the first solvable hand, zero the streak and score. */
export function newGame(
  variant: Variant,
  opts: { now: number; rng?: Rng; records?: Records },
): GameState {
  return {
    variant,
    current: dealSolvableHand(variant, opts.rng),
    handStartedAt: opts.now,
    streak: 0,
    score: 0,
    records: opts.records ?? EMPTY_RECORDS,
  };
}

/** The result of submitting an attempt. On a wrong answer, `state` is unchanged. */
export type SubmitOutcome =
  | { solved: true; elapsedMs: number; gained: number; state: GameState }
  | { solved: false; error: ValidationError; state: GameState };

/**
 * Submit an expression as a solution to the current hand. Judged by core's
 * validateSolution. On success: score by speed, bump the streak, update the
 * records, and deal the next solvable hand. On failure: nothing changes — a
 * wrong answer costs only time, it does not break the streak (only a pass does).
 */
export function submitSolution(
  state: GameState,
  expr: Expr,
  now: number,
  rng?: Rng,
): SubmitOutcome {
  const result = validateSolution(expr, {
    hand: state.current.hand,
    target: state.current.target,
    operations: CLASSIC_OPERATIONS,
  });
  if (!result.valid) {
    return { solved: false, error: result.error, state };
  }

  const elapsedMs = Math.max(0, now - state.handStartedAt);
  const gained = solveScore(elapsedMs);
  const streak = state.streak + 1;
  const records: Records = {
    bestStreak: Math.max(state.records.bestStreak, streak),
    bestTimeMs: state.records.bestTimeMs === null ? elapsedMs : Math.min(state.records.bestTimeMs, elapsedMs),
  };
  const next: GameState = {
    ...state,
    current: dealSolvableHand(state.variant, rng),
    handStartedAt: now,
    streak,
    score: state.score + gained,
    records,
  };
  return { solved: true, elapsedMs, gained, state: next };
}

/**
 * Give up the current hand: the streak resets to 0 and a new hand is dealt.
 * Score total and personal bests are untouched — passing forfeits the streak,
 * nothing else.
 */
export function passHand(state: GameState, now: number, rng?: Rng): GameState {
  return {
    ...state,
    current: dealSolvableHand(state.variant, rng),
    handStartedAt: now,
    streak: 0,
  };
}

// ---------------------------------------------------------------------------
// Persistence (local high scores)
// ---------------------------------------------------------------------------

/**
 * Minimal async key/value store — the slice of AsyncStorage / expo-secure-store
 * the engine needs. Injected so the logic stays pure and is testable with an
 * in-memory fake; the real adapter is wired in at the screen layer (step 3).
 */
export interface KeyValueStore {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
}

const RECORDS_KEY = "twenty-something:records";

/** Load saved records, returning fresh EMPTY_RECORDS on missing/corrupt data. */
export async function loadRecords(store: KeyValueStore): Promise<Records> {
  const raw = await store.getItem(RECORDS_KEY);
  if (raw === null) return { ...EMPTY_RECORDS };
  try {
    return sanitizeRecords(JSON.parse(raw));
  } catch {
    return { ...EMPTY_RECORDS };
  }
}

/** Persist records as JSON under the records key. */
export async function saveRecords(store: KeyValueStore, records: Records): Promise<void> {
  await store.setItem(RECORDS_KEY, JSON.stringify(records));
}

/** Coerce untrusted parsed JSON into a valid Records, dropping junk values. */
function sanitizeRecords(x: unknown): Records {
  const o = (typeof x === "object" && x !== null ? x : {}) as Record<string, unknown>;
  const s = o.bestStreak;
  const t = o.bestTimeMs;
  return {
    bestStreak: typeof s === "number" && Number.isFinite(s) && s >= 0 ? Math.floor(s) : 0,
    bestTimeMs: typeof t === "number" && Number.isFinite(t) && t >= 0 ? Math.floor(t) : null,
  };
}
