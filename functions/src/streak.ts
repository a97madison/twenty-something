/**
 * Pure streak logic, isolated from Firestore so it can be unit-tested.
 *
 * Rule: solving on consecutive UTC dates extends the streak; a gap resets it
 * to 1; re-solving the same date is a no-op (idempotent). All date reasoning
 * is on "YYYY-MM-DD" strings compared as UTC days — never on client clocks.
 */

export interface StreakState {
  currentStreak: number;
  maxStreak: number;
  lastPlayedDate: string | null;
}

/** Days between two "YYYY-MM-DD" dates (b - a), via UTC midnight. */
export function dayDelta(a: string, b: string): number {
  const ms = Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`);
  return Math.round(ms / 86_400_000);
}

/**
 * Apply a solve on `today` to a prior streak state. Pure: returns the next
 * state plus whether this solve is fresh (false = already solved today).
 */
export function applySolve(
  prev: StreakState,
  today: string,
): { next: StreakState; counted: boolean } {
  if (prev.lastPlayedDate === today) {
    // Already solved today — idempotent, nothing changes.
    return { next: prev, counted: false };
  }

  let currentStreak: number;
  if (prev.lastPlayedDate !== null && dayDelta(prev.lastPlayedDate, today) === 1) {
    currentStreak = prev.currentStreak + 1; // consecutive day
  } else {
    currentStreak = 1; // first ever, or gap broke the streak
  }

  return {
    next: {
      currentStreak,
      maxStreak: Math.max(prev.maxStreak, currentStreak),
      lastPlayedDate: today,
    },
    counted: true,
  };
}

/**
 * Server-derived solve time in whole seconds: elapsed between when the puzzle
 * became available (startMs) and now (nowMs). Never trusts a client-reported
 * duration — that would be spoofable on any time-based leaderboard. Clamped to
 * >= 0 to absorb minor clock skew.
 */
export function deriveSolveTimeSec(startMs: number, nowMs: number): number {
  return Math.max(0, Math.round((nowMs - startMs) / 1000));
}

/** Attempts is a display stat, not a ranking key; clamp to a sane integer. */
export function sanitizeAttempts(raw: unknown): number {
  return typeof raw === "number" && Number.isFinite(raw) && raw >= 1
    ? Math.floor(raw)
    : 1;
}
