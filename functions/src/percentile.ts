/**
 * Daily-game percentile — where a player's game RATING falls within the field
 * of everyone who played that day's challenge (same date + variant). Pure and
 * Firestore-free so it can be unit-tested; the callable in index.ts only reads
 * the field of ratings and delegates the ranking here.
 *
 * Trust note: unlike the room scorer, a daily rating depends on client-measured
 * solve times that an OFFLINE daily cannot re-derive server-side. This stage
 * stores the reported rating and ranks it — the percentile is a SOCIAL metric,
 * not an anti-cheat boundary. (A future authoritative version would re-verify
 * each hand's solution and bound the per-hand time server-side.)
 */

/** Largest rating a daily game can earn (mirrors core's MAX_STARS). */
export const MAX_RATING = 5;

export type RatingValidation =
  | { ok: true; rating: number }
  | { ok: false; reason: string };

/** Is `x` a "YYYY-MM-DD" date key? */
export function isDateKey(x: unknown): x is string {
  return typeof x === "string" && /^\d{4}-\d{2}-\d{2}$/.test(x);
}

/** Firestore doc id for one day's field of one variant. "/" is illegal in ids. */
export function dailyFieldKey(date: string, variant: string): string {
  return `${date}__${variant}`;
}

/** Validate a client-submitted rating: a finite number in [0, MAX_RATING]. */
export function validateRating(raw: unknown): RatingValidation {
  if (typeof raw !== "number" || !Number.isFinite(raw)) {
    return { ok: false, reason: "rating_not_a_number" };
  }
  if (raw < 0 || raw > MAX_RATING) {
    return { ok: false, reason: "rating_out_of_range" };
  }
  return { ok: true, rating: raw };
}

/**
 * Percentile rank of `myRating` within `field` — the ratings of everyone who
 * played that day, INCLUDING this player. Standard half-tie definition:
 *
 *     (countBelow + 0.5 × countEqual) / total × 100
 *
 * Higher is better; ties split evenly, so a perfectly average score lands near
 * 50 and the field is symmetric (top and bottom mirror each other). Result is
 * an integer 0–100. A lone player (and, defensively, an empty field) returns
 * 50 — trivially average against only themselves.
 */
export function computePercentile(field: number[], myRating: number): number {
  if (field.length === 0) return 50; // never happens: the caller is in the field
  let below = 0;
  let equal = 0;
  for (const r of field) {
    if (r < myRating) below++;
    else if (r === myRating) equal++;
  }
  return Math.round(((below + 0.5 * equal) / field.length) * 100);
}
