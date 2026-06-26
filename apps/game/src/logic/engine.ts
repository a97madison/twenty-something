/**
 * Offline game engine — pure, UI-free, fully node-testable.
 *
 * The "judge the hand" model: hands are dealt at NATURAL distribution (some are
 * genuinely unsolvable) and the player must JUDGE each one — solve it, declare
 * "no solution", or pass (give up). There is no points score. The metrics are
 * accuracy, solve time, and a composite star rating, tracked PER VARIANT.
 *
 * Everything here is deterministic: `now`, `rng`, and the local `dayKey` are
 * injected, never read from the environment, so every transition is unit-testable
 * the way core/functions are. Correctness is judged by core's `validateSolution`
 * (the same cheat-proof authority the server uses); revealed answers come from
 * core's `findFirstSolution`.
 *
 * This is deliberately ONE module importing only the core package. Metro bundles
 * this source and rejects `.ts` import extensions, while node's test runner
 * requires them — keeping the engine self-contained avoids that conflict (tests
 * import `./engine.ts`; the screens reach it through an extensionless barrel).
 */

import {
  validateSolution,
  computeTarget,
  isSolvable,
  findFirstSolution,
  formatExpr,
  CLASSIC_OPERATIONS,
  type Expr,
  type Hand,
  type Variant,
  type ValidationError,
} from "@twenty-something/core";

export const VARIANTS: readonly Variant[] = ["24", "20_something"];

// ---------------------------------------------------------------------------
// Dealing
// ---------------------------------------------------------------------------

/** A source of randomness in [0, 1). Injected so deals are deterministic in tests. */
export type Rng = () => number;

/** A dealt hand: cosmetic values/suits, the typed core hand, target, and truth. */
export interface DealtHand {
  /** Four card values, A–K = 1–13, in flip order (index 3 = last-flipped). */
  values: number[];
  /** Four suit indices 0–3 — purely cosmetic, never used in arithmetic. */
  suits: number[];
  /** The typed core hand with stable ids c0–c3. */
  hand: Hand;
  /** The number to reach, computed for the variant. */
  target: number;
  /** Ground truth: does a solution exist? The player must judge this. */
  solvable: boolean;
}

const CARD_COUNT = 4;
const VALUE_RANGE = 13; // A..K
const SUIT_RANGE = 4;

function buildHand(values: number[]): Hand {
  return [
    { id: "c0", value: values[0]! },
    { id: "c1", value: values[1]! },
    { id: "c2", value: values[2]! },
    { id: "c3", value: values[3]! },
  ];
}

/**
 * Deal ONE hand at natural distribution — no re-rolling. The hand may be
 * unsolvable; its `solvable` flag carries the ground truth from core's solver,
 * which is what the player is being asked to judge.
 */
export function dealHand(variant: Variant, rng: Rng = Math.random): DealtHand {
  const values = Array.from({ length: CARD_COUNT }, () => 1 + Math.floor(rng() * VALUE_RANGE));
  const suits = Array.from({ length: CARD_COUNT }, () => Math.floor(rng() * SUIT_RANGE));
  const hand = buildHand(values);
  const target = computeTarget(variant, hand);
  const solvable = isSolvable({ hand, target, operations: CLASSIC_OPERATIONS });
  return { values, suits, hand, target, solvable };
}

/** Deal `n` natural-distribution hands. */
export function dealHands(variant: Variant, n: number, rng: Rng = Math.random): DealtHand[] {
  return Array.from({ length: n }, () => dealHand(variant, rng));
}

// --- Deterministic daily deal -------------------------------------------------

/** Deterministic PRNG (mulberry32) — same seed ⇒ same stream. */
function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** FNV-1a hash of a string → uint32 seed. */
function hashSeed(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Number of hands in a daily challenge (variable — tune here). */
export const DAILY_HANDS = 5;

/**
 * Deal `n` hands deterministically from a free-form `seed` string: the same
 * (seed, variant, n) always yields the SAME hands. This is the shared-deal
 * primitive behind both the daily challenge (seed = the date) and head-to-head
 * friend challenges (seed = a random code), so two players who use the same seed
 * judge the exact same cards — offline, no backend.
 */
export function dealSeededHands(seed: string, variant: Variant, n: number): DealtHand[] {
  const rng = mulberry32(hashSeed(`${seed}|${variant}`));
  return Array.from({ length: n }, () => dealHand(variant, rng));
}

/**
 * The shared daily challenge: everyone who plays `dateKey` + `variant` gets the
 * SAME `n` hands, generated from a date seed. Fully offline and deterministic —
 * no backend needed for the hands themselves (only the percentile is server-side).
 */
export function dealDailyHands(
  variant: Variant,
  dateKey: string,
  n: number = DAILY_HANDS,
): DealtHand[] {
  return dealSeededHands(dateKey, variant, n);
}

// ---------------------------------------------------------------------------
// Star rating (composite of accuracy + speed)
// ---------------------------------------------------------------------------

/** Solve at or under this (ms) earns the full speed bonus. */
export const FAST_MS = 5_000;
/** Solve at or over this (ms) earns no speed bonus (still correct). */
export const SLOW_MS = 60_000;
/** A correct hand is worth at least this many stars (the "you got it right" half). */
export const CORRECT_BASE_STARS = 2.5;
/** Maximum stars for a single hand. */
export const MAX_STARS = 5;

/**
 * Star score for a CORRECT hand, in [CORRECT_BASE_STARS, MAX_STARS]: half the
 * stars for being right, up to half more for being fast. Wrong/passed hands
 * score 0 — that is applied by the caller, not here.
 */
export function starScore(elapsedMs: number): number {
  const t = Math.max(0, elapsedMs);
  const speedFrac = 1 - clamp01((t - FAST_MS) / (SLOW_MS - FAST_MS));
  return CORRECT_BASE_STARS + (MAX_STARS - CORRECT_BASE_STARS) * speedFrac;
}

function clamp01(x: number): number {
  return x < 0 ? 0 : x > 1 ? 1 : x;
}

// ---------------------------------------------------------------------------
// Per-variant statistics (per-day buckets → all-time + rolling-7-day rollups)
// ---------------------------------------------------------------------------

/** One day's tally for one variant. `dayKey` is the local "YYYY-MM-DD". */
export interface DayBucket {
  /** Committed decisions that day. */
  count: number;
  /** Of those, how many were correct. */
  correctCount: number;
  /** Sum of solve times (ms) over CORRECT decisions only (for avg time). */
  timeSumCorrect: number;
  /** Sum of star scores over ALL decisions (for rating). */
  starSum: number;
}

/** All stored stats for one variant. */
export interface VariantStats {
  /** dayKey → bucket. all-time = aggregate all; weekly = aggregate last 7 days. */
  days: Record<string, DayBucket>;
  /** Longest streak ever reached for this variant. */
  bestStreak: number;
  /** Fastest single correct solve (ms), or null until the first correct solve. */
  bestTimeMs: number | null;
}

/** Stats for every variant. */
export type AllStats = Record<Variant, VariantStats>;

function emptyVariantStats(): VariantStats {
  return { days: {}, bestStreak: 0, bestTimeMs: null };
}

export function emptyStats(): AllStats {
  return { "24": emptyVariantStats(), "20_something": emptyVariantStats() };
}

/** A rolled-up view over some set of day buckets. */
export interface Rollup {
  /** Decisions in the window. */
  count: number;
  /** Correct decisions in the window. */
  correctCount: number;
  /** correctCount / count, or null when count === 0. */
  accuracy: number | null;
  /** Mean solve time (ms) over correct decisions, or null when none correct. */
  avgTimeMs: number | null;
  /** Mean star score over all decisions, or null when count === 0. */
  rating: number | null;
}

function rollup(buckets: DayBucket[]): Rollup {
  let count = 0;
  let correctCount = 0;
  let timeSumCorrect = 0;
  let starSum = 0;
  for (const b of buckets) {
    count += b.count;
    correctCount += b.correctCount;
    timeSumCorrect += b.timeSumCorrect;
    starSum += b.starSum;
  }
  return {
    count,
    correctCount,
    accuracy: count === 0 ? null : correctCount / count,
    avgTimeMs: correctCount === 0 ? null : timeSumCorrect / correctCount,
    rating: count === 0 ? null : starSum / count,
  };
}

/** All-time rollup for a variant (every day bucket). */
export function allTimeRollup(vs: VariantStats): Rollup {
  return rollup(Object.values(vs.days));
}

const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;

/**
 * Monday-based day index (0 = Mon … 6 = Sun) for a days-since-epoch count.
 * Epoch day 0 (1970-01-01) was a Thursday, i.e. Monday-index 3.
 */
function mondayDow(epochDay: number): number {
  return ((((epochDay % 7) + 7) % 7) + 3) % 7;
}

/**
 * Fixed-week rollup for a variant: buckets in the current Monday→Sunday week
 * (the week containing `todayKey`). The window resets every Monday — see
 * `msUntilWeeklyReset` for the exact instant. Pure; the SCREEN passes the local
 * dayKey. (The reset *instant* is UTC-anchored so it's identical worldwide; the
 * day buckets are local, which only matters in the boundary hours.)
 */
export function weeklyRollup(vs: VariantStats, todayKey: string): Rollup {
  const today = epochDayFromKey(todayKey);
  const from = today - mondayDow(today); // this week's Monday
  const inWindow = Object.entries(vs.days)
    .filter(([key]) => {
      const e = epochDayFromKey(key);
      return e >= from && e <= today;
    })
    .map(([, b]) => b);
  return rollup(inWindow);
}

/**
 * Milliseconds until the weekly window resets — the next Monday 00:00:00 UTC.
 * UTC-anchored on purpose: every player's week turns over at the same instant
 * regardless of timezone. Always in (0, 7 days].
 */
export function msUntilWeeklyReset(nowMs: number): number {
  const dayIndex = Math.floor(nowMs / DAY_MS); // whole UTC days since epoch
  const nextResetDay = dayIndex - mondayDow(dayIndex) + 7;
  return nextResetDay * DAY_MS - nowMs;
}

/** Split a duration (ms) into whole days + leftover whole hours, for "Xd Yh". */
export function daysAndHours(ms: number): { days: number; hours: number } {
  const t = Math.max(0, ms);
  return { days: Math.floor(t / DAY_MS), hours: Math.floor((t % DAY_MS) / HOUR_MS) };
}

/**
 * Days since the Unix epoch for a "YYYY-MM-DD" key (Howard Hinnant's
 * days_from_civil). Pure integer math — no Date, so it is deterministic and
 * timezone-free; the SCREEN is responsible for producing a local-time dayKey.
 */
export function epochDayFromKey(key: string): number {
  const [ys, ms, ds] = key.split("-");
  const y0 = Number(ys);
  const m = Number(ms);
  const d = Number(ds);
  const y = y0 - (m <= 2 ? 1 : 0);
  const era = Math.floor((y >= 0 ? y : y - 399) / 400);
  const yoe = y - era * 400;
  const doy = Math.floor((153 * (m + (m > 2 ? -3 : 9)) + 2) / 5) + d - 1;
  const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy;
  return era * 146097 + doe - 719468;
}

/** Record one committed decision into a variant's stats (returns a new AllStats). */
function recordDecision(
  stats: AllStats,
  variant: Variant,
  dayKey: string,
  decision: { correct: boolean; elapsedMs: number; star: number },
  streakAfter: number,
): AllStats {
  const vs = stats[variant];
  const prev = vs.days[dayKey] ?? { count: 0, correctCount: 0, timeSumCorrect: 0, starSum: 0 };
  const day: DayBucket = {
    count: prev.count + 1,
    correctCount: prev.correctCount + (decision.correct ? 1 : 0),
    timeSumCorrect: prev.timeSumCorrect + (decision.correct ? decision.elapsedMs : 0),
    starSum: prev.starSum + decision.star,
  };
  const bestTimeMs = decision.correct
    ? vs.bestTimeMs === null
      ? decision.elapsedMs
      : Math.min(vs.bestTimeMs, decision.elapsedMs)
    : vs.bestTimeMs;
  const nextVs: VariantStats = {
    days: { ...vs.days, [dayKey]: day },
    bestStreak: Math.max(vs.bestStreak, streakAfter),
    bestTimeMs,
  };
  return { ...stats, [variant]: nextVs };
}

// ---------------------------------------------------------------------------
// Game state + transitions
// ---------------------------------------------------------------------------

/** Tally for the CURRENT run (drives the end-of-game summary). */
export interface SessionTally {
  /** Committed decisions this run. */
  total: number;
  /** Correct decisions this run. */
  correct: number;
  /** Sum of solve times (ms) over correct decisions this run. */
  timeSumCorrect: number;
  /** Sum of star scores over all decisions this run. */
  starSum: number;
}

const EMPTY_TALLY: SessionTally = { total: 0, correct: 0, timeSumCorrect: 0, starSum: 0 };

/** What to show the player after a wrong "no solution" or a pass (give up). */
export interface Reveal {
  /** A worked solution string, or null when the hand genuinely had none. */
  solution: string | null;
}

/** The whole offline game state. Plain data — no methods, no UI. */
export interface GameState {
  variant: Variant;
  /** The pre-dealt deck for this bounded session (length = handsTotal). */
  hands: DealtHand[];
  /** Index of the current hand == hands played so far. */
  index: number;
  /** Timestamp (ms) the current hand was dealt — solve time measures from here. */
  handStartedAt: number;
  /** Consecutive correct decisions. */
  streak: number;
  /** This run's tally. */
  session: SessionTally;
  /** Persisted per-variant stats (loaded on mount, updated each decision). */
  stats: AllStats;
  /** Reveal from the most recent decision, or null. Cleared when the hand advances. */
  reveal: Reveal | null;
  /** True once every hand in the session has been decided. */
  done: boolean;
}

/** The current hand, or undefined once the session is done. */
export function currentHand(state: GameState): DealtHand | undefined {
  return state.hands[state.index];
}

/** Total hands in this session. */
export function handsTotal(state: GameState): number {
  return state.hands.length;
}

/**
 * Start a fresh bounded run over a pre-dealt deck of hands. Build the deck with
 * `dealHands` (normal play) or `dealDailyHands` (the daily challenge), then pass
 * it here. Zeroes the streak and session tally.
 */
export function newGame(
  variant: Variant,
  hands: DealtHand[],
  opts: { now: number; stats?: AllStats },
): GameState {
  return {
    variant,
    hands,
    index: 0,
    handStartedAt: opts.now,
    streak: 0,
    session: { ...EMPTY_TALLY },
    stats: opts.stats ?? emptyStats(),
    reveal: null,
    done: hands.length === 0,
  };
}

/** Apply a committed decision: fold into session tally + stats, advance the hand. */
function commit(
  state: GameState,
  dayKey: string,
  now: number,
  decision: { correct: boolean; elapsedMs: number; star: number },
  reveal: Reveal | null,
): GameState {
  const streak = decision.correct ? state.streak + 1 : 0;
  const session: SessionTally = {
    total: state.session.total + 1,
    correct: state.session.correct + (decision.correct ? 1 : 0),
    timeSumCorrect: state.session.timeSumCorrect + (decision.correct ? decision.elapsedMs : 0),
    starSum: state.session.starSum + decision.star,
  };
  const stats = recordDecision(state.stats, state.variant, dayKey, decision, streak);
  const index = state.index + 1;
  return {
    ...state,
    index,
    handStartedAt: now,
    streak,
    session,
    stats,
    reveal,
    done: index >= state.hands.length,
  };
}

/** The result of submitting an expression. On a wrong answer, `state` is unchanged. */
export type SubmitOutcome =
  | { solved: true; elapsedMs: number; stars: number; state: GameState }
  | { solved: false; error: ValidationError; state: GameState };

/**
 * Submit an expression as a solution to the current hand. Judged by core's
 * validateSolution. A CORRECT answer is a committed decision: scored by speed,
 * streak +1, stats updated, hand advances. A WRONG answer is NOT committed —
 * nothing changes, the clock keeps running, the player tries again.
 */
export function submitSolution(
  state: GameState,
  expr: Expr,
  now: number,
  dayKey: string,
): SubmitOutcome {
  const hand = currentHand(state);
  if (!hand) return { solved: false, error: "wrong_cards", state };
  const result = validateSolution(expr, {
    hand: hand.hand,
    target: hand.target,
    operations: CLASSIC_OPERATIONS,
  });
  if (!result.valid) {
    return { solved: false, error: result.error, state };
  }
  const elapsedMs = Math.max(0, now - state.handStartedAt);
  const stars = starScore(elapsedMs);
  const next = commit(state, dayKey, now, { correct: true, elapsedMs, star: stars }, null);
  return { solved: true, elapsedMs, stars, state: next };
}

/** The result of a judge action ("no solution" or pass). */
export interface DecisionOutcome {
  correct: boolean;
  /** A reveal when the action exposes an answer (wrong "no solution", or a pass). */
  reveal: Reveal | null;
  state: GameState;
}

/** Render a worked solution for the current hand, or null if it has none. */
function revealFor(hand: DealtHand): Reveal {
  if (!hand.solvable) return { solution: null };
  const sol = findFirstSolution({ hand: hand.hand, target: hand.target, operations: CLASSIC_OPERATIONS });
  return { solution: sol ? formatExpr(sol.expr) : null };
}

/**
 * Claim the current hand has NO solution. Correct iff the hand is genuinely
 * unsolvable (streak +1). If it WAS solvable this is wrong: reveal a solution,
 * break the streak, count it incorrect.
 */
export function claimNoSolution(state: GameState, now: number, dayKey: string): DecisionOutcome {
  const hand = currentHand(state);
  if (!hand) return { correct: false, reveal: null, state };
  const elapsedMs = Math.max(0, now - state.handStartedAt);
  const correct = !hand.solvable;
  if (correct) {
    const stars = starScore(elapsedMs);
    const next = commit(state, dayKey, now, { correct: true, elapsedMs, star: stars }, null);
    return { correct: true, reveal: null, state: next };
  }
  const reveal = revealFor(hand);
  const next = commit(state, dayKey, now, { correct: false, elapsedMs, star: 0 }, reveal);
  return { correct: false, reveal, state: next };
}

/**
 * Pass (give up) on the current hand: always counts incorrect — reveal a
 * solution (or "none existed"), break the streak, advance. UI labels this "Pass".
 */
export function giveUp(state: GameState, now: number, dayKey: string): DecisionOutcome {
  const hand = currentHand(state);
  if (!hand) return { correct: false, reveal: null, state };
  const elapsedMs = Math.max(0, now - state.handStartedAt);
  const reveal = revealFor(hand);
  const next = commit(state, dayKey, now, { correct: false, elapsedMs, star: 0 }, reveal);
  return { correct: false, reveal, state: next };
}

// ---------------------------------------------------------------------------
// Persistence (per-variant stats)
// ---------------------------------------------------------------------------

/**
 * Minimal async key/value store — the slice of AsyncStorage the engine needs.
 * Injected so the logic stays pure and is testable with an in-memory fake; the
 * real adapter is wired in at the screen layer.
 */
export interface KeyValueStore {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
}

const STATS_KEY = "twenty-something:stats:v2";

/** Load saved stats, returning fresh emptyStats() on missing/corrupt data. */
export async function loadStats(store: KeyValueStore): Promise<AllStats> {
  const raw = await store.getItem(STATS_KEY);
  if (raw === null) return emptyStats();
  try {
    return sanitizeStats(JSON.parse(raw));
  } catch {
    return emptyStats();
  }
}

/** Persist stats as JSON. */
export async function saveStats(store: KeyValueStore, stats: AllStats): Promise<void> {
  await store.setItem(STATS_KEY, JSON.stringify(stats));
}

// --- Daily challenge: one attempt per day --------------------------------------

const DAILY_DONE_KEY = "twenty-something:daily-done";

/** The dayKey of the last completed daily challenge, or null if never played. */
export async function loadDailyDone(store: KeyValueStore): Promise<string | null> {
  return store.getItem(DAILY_DONE_KEY);
}

/** Record that today's daily challenge has been completed. */
export async function saveDailyDone(store: KeyValueStore, dayKey: string): Promise<void> {
  await store.setItem(DAILY_DONE_KEY, dayKey);
}

/** Whether the daily challenge for `todayKey` has already been played. */
export function isDailyDone(lastDailyKey: string | null, todayKey: string): boolean {
  return lastDailyKey === todayKey;
}

// --- Daily streak (consecutive days) with freeze protection --------------------
//
// The retention spine: a streak of consecutive days completing the daily, plus
// "streak freezes" that auto-bridge a missed day so one slip doesn't wipe a long
// run (pure loss-aversion — see ROADMAP §6 #3). A freeze is EARNED each "perfect
// week" (every 7-day multiple), banked up to a small cap. Everything is keyed by
// the local dayKey the screen supplies, so this stays pure and timezone-free.

/** Most freezes a player can bank. */
export const MAX_FREEZES = 2;
/** Streak length that completes a "perfect week" and earns a freeze. */
export const PERFECT_WEEK = 7;

export interface DailyStreak {
  /** Consecutive days the daily was completed. */
  current: number;
  /** Best streak ever reached. */
  best: number;
  /** The last dayKey the daily was completed, or null if never. */
  lastDate: string | null;
  /** Banked streak freezes. */
  freezes: number;
  /** Lifetime count of perfect weeks reached. */
  perfectWeeks: number;
}

export function emptyDailyStreak(): DailyStreak {
  return { current: 0, best: 0, lastDate: null, freezes: 0, perfectWeeks: 0 };
}

/** What happened on a daily completion — drives the summary's messaging. */
export interface DailyStreakEvent {
  kind: "first" | "extended" | "frozen" | "reset" | "same_day";
  /** Missed days bridged by spending freezes (0 unless `kind === "frozen"`). */
  freezesUsed: number;
  /** A perfect week just banked a freeze. */
  earnedFreeze: boolean;
  /** The streak just reached a 7-day multiple. */
  perfectWeek: boolean;
}

function finalizeStreak(
  prev: DailyStreak,
  current: number,
  freezesUsed: number,
  kind: DailyStreakEvent["kind"],
  todayKey: string,
): { state: DailyStreak; event: DailyStreakEvent } {
  const perfectWeek = current > 0 && current % PERFECT_WEEK === 0;
  let freezes = prev.freezes - freezesUsed;
  const earnedFreeze = perfectWeek && freezes < MAX_FREEZES;
  if (earnedFreeze) freezes += 1;
  const state: DailyStreak = {
    current,
    best: Math.max(prev.best, current),
    lastDate: todayKey,
    freezes,
    perfectWeeks: prev.perfectWeeks + (perfectWeek ? 1 : 0),
  };
  return { state, event: { kind, freezesUsed, earnedFreeze, perfectWeek } };
}

/**
 * Record that the player completed the daily on `todayKey`. Extends the streak
 * if it's the next day, bridges a gap with freezes if there are enough, else
 * resets to 1. Pure — returns the next state plus what happened.
 */
export function recordDailyPlay(state: DailyStreak, todayKey: string): { state: DailyStreak; event: DailyStreakEvent } {
  if (state.lastDate === null) {
    return finalizeStreak(state, 1, 0, "first", todayKey);
  }
  const gap = epochDayFromKey(todayKey) - epochDayFromKey(state.lastDate);
  if (gap <= 0) {
    // Already counted today (the daily is gated to one play/day) — no change.
    return { state, event: { kind: "same_day", freezesUsed: 0, earnedFreeze: false, perfectWeek: false } };
  }
  if (gap === 1) {
    return finalizeStreak(state, state.current + 1, 0, "extended", todayKey);
  }
  const missed = gap - 1; // gap >= 2
  if (state.freezes >= missed) {
    return finalizeStreak(state, state.current + 1, missed, "frozen", todayKey);
  }
  return finalizeStreak(state, 1, 0, "reset", todayKey);
}

/** Live, display-only view of where the streak stands as of `todayKey`. */
export interface DailyStreakStatus {
  /** The streak as it stands today — 0 if it has lapsed beyond freeze coverage. */
  current: number;
  freezes: number;
  /** Today's daily is already done. */
  playedToday: boolean;
  /** The streak is still going (or recoverable by playing today). */
  alive: boolean;
  /** Alive but unplayed today — play to keep it. */
  atRisk: boolean;
}

/**
 * Where the streak stands as of `todayKey`, WITHOUT mutating — for Home/Stats.
 * Mirrors `recordDailyPlay`'s rules so the displayed streak matches what a play
 * today would produce.
 */
export function dailyStreakStatus(state: DailyStreak, todayKey: string): DailyStreakStatus {
  const base = { current: state.current, freezes: state.freezes };
  if (state.lastDate === null) {
    return { ...base, current: 0, playedToday: false, alive: false, atRisk: false };
  }
  const gap = epochDayFromKey(todayKey) - epochDayFromKey(state.lastDate);
  if (gap <= 0) return { ...base, playedToday: true, alive: true, atRisk: false };
  if (gap === 1) return { ...base, playedToday: false, alive: true, atRisk: true };
  const missed = gap - 1;
  if (state.freezes >= missed) return { ...base, playedToday: false, alive: true, atRisk: true };
  return { ...base, current: 0, playedToday: false, alive: false, atRisk: false };
}

const DAILY_STREAK_KEY = "twenty-something:daily-streak";

/** Load the saved daily streak, fresh on missing/corrupt data. */
export async function loadDailyStreak(store: KeyValueStore): Promise<DailyStreak> {
  const raw = await store.getItem(DAILY_STREAK_KEY);
  if (raw === null) return emptyDailyStreak();
  try {
    return sanitizeDailyStreak(JSON.parse(raw));
  } catch {
    return emptyDailyStreak();
  }
}

/** Persist the daily streak as JSON. */
export async function saveDailyStreak(store: KeyValueStore, state: DailyStreak): Promise<void> {
  await store.setItem(DAILY_STREAK_KEY, JSON.stringify(state));
}

function sanitizeDailyStreak(x: unknown): DailyStreak {
  const o = (typeof x === "object" && x !== null ? x : {}) as Record<string, unknown>;
  const ld = o.lastDate;
  return {
    current: Math.floor(num(o.current)),
    best: Math.floor(num(o.best)),
    lastDate: typeof ld === "string" ? ld : null,
    freezes: Math.min(MAX_FREEZES, Math.floor(num(o.freezes))),
    perfectWeeks: Math.floor(num(o.perfectWeeks)),
  };
}

// --- Friend head-to-head record (rivals) --------------------------------------
//
// A persistent win/loss/tie record per friend, so a challenge isn't a one-off —
// you build a series against a "specific friend". Identity is the challenger's
// stable playerId (from a TS2 code), falling back to their name when there isn't
// one, so renames don't fork the record and two same-named friends don't merge.
// The ACCEPTER records each finished challenge (they see both ratings); over a
// rematch exchange both sides accrue their own record.

export interface Rival {
  /** Latest display name seen for this friend. */
  name: string;
  /** Games you scored higher / lower / equal on. */
  wins: number;
  losses: number;
  ties: number;
  /** Last dayKey you played them, or null. */
  lastPlayed: string | null;
}

export type Rivals = Record<string, Rival>;

export function emptyRivals(): Rivals {
  return {};
}

/** Stable record key for a friend: their playerId if known, else their name. */
export function friendKey(playerId: string | undefined, name: string): string {
  const id = (playerId ?? "").trim();
  return id ? `id:${id}` : `name:${name.trim().toLowerCase()}`;
}

/** Fold one finished head-to-head game into the record (from YOUR point of view). */
export function recordRivalGame(
  rivals: Rivals,
  key: string,
  name: string,
  result: "win" | "loss" | "tie",
  dayKey: string,
): Rivals {
  const prev = rivals[key] ?? { name, wins: 0, losses: 0, ties: 0, lastPlayed: null };
  const next: Rival = {
    name: name.trim() || prev.name, // keep the latest non-empty name
    wins: prev.wins + (result === "win" ? 1 : 0),
    losses: prev.losses + (result === "loss" ? 1 : 0),
    ties: prev.ties + (result === "tie" ? 1 : 0),
    lastPlayed: dayKey,
  };
  return { ...rivals, [key]: next };
}

const RIVALS_KEY = "twenty-something:rivals";

/** Load the saved rivals record, fresh on missing/corrupt data. */
export async function loadRivals(store: KeyValueStore): Promise<Rivals> {
  const raw = await store.getItem(RIVALS_KEY);
  if (raw === null) return emptyRivals();
  try {
    return sanitizeRivals(JSON.parse(raw));
  } catch {
    return emptyRivals();
  }
}

/** Persist the rivals record as JSON. */
export async function saveRivals(store: KeyValueStore, rivals: Rivals): Promise<void> {
  await store.setItem(RIVALS_KEY, JSON.stringify(rivals));
}

function sanitizeRivals(x: unknown): Rivals {
  const o = (typeof x === "object" && x !== null ? x : {}) as Record<string, unknown>;
  const out: Rivals = {};
  for (const [k, v] of Object.entries(o)) {
    const r = (typeof v === "object" && v !== null ? v : {}) as Record<string, unknown>;
    out[k] = {
      name: typeof r.name === "string" ? r.name : "",
      wins: Math.floor(num(r.wins)),
      losses: Math.floor(num(r.losses)),
      ties: Math.floor(num(r.ties)),
      lastPlayed: typeof r.lastPlayed === "string" ? r.lastPlayed : null,
    };
  }
  return out;
}

function num(x: unknown, floor = 0): number {
  return typeof x === "number" && Number.isFinite(x) && x >= floor ? x : floor;
}

function sanitizeVariant(x: unknown): VariantStats {
  const o = (typeof x === "object" && x !== null ? x : {}) as Record<string, unknown>;
  const daysRaw = (typeof o.days === "object" && o.days !== null ? o.days : {}) as Record<string, unknown>;
  const days: Record<string, DayBucket> = {};
  for (const [key, v] of Object.entries(daysRaw)) {
    const b = (typeof v === "object" && v !== null ? v : {}) as Record<string, unknown>;
    days[key] = {
      count: Math.floor(num(b.count)),
      correctCount: Math.floor(num(b.correctCount)),
      timeSumCorrect: num(b.timeSumCorrect),
      starSum: num(b.starSum),
    };
  }
  const t = o.bestTimeMs;
  return {
    days,
    bestStreak: Math.floor(num(o.bestStreak)),
    bestTimeMs: typeof t === "number" && Number.isFinite(t) && t >= 0 ? Math.floor(t) : null,
  };
}

/** Coerce untrusted parsed JSON into a valid AllStats, dropping junk values. */
function sanitizeStats(x: unknown): AllStats {
  const o = (typeof x === "object" && x !== null ? x : {}) as Record<string, unknown>;
  return { "24": sanitizeVariant(o["24"]), "20_something": sanitizeVariant(o["20_something"]) };
}
