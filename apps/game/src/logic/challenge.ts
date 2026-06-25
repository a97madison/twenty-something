/**
 * Head-to-head friend challenges — pure, UI-free, fully node-testable.
 *
 * A "challenge" is a self-contained, shareable CODE that lets two people play the
 * exact same hands without a backend and without playing at the same time. The
 * creator plays N hands dealt from a random `seed`, then shares a code carrying
 * { seed, variant, hands, their rating, their name }. The recipient pastes it,
 * the app re-deals the SAME hands from that seed (see `dealSeededHands`), and at
 * the end compares the two ratings for a head-to-head verdict.
 *
 * The code is the whole transport — no server, no auth, no network. So this
 * module is just string encode/decode plus the win/loss/tie comparison, all
 * pure. Decoding is deliberately forgiving of junk paste (returns null, never
 * throws) the way the calculator's `parseTokens` is.
 */

import type { Variant } from "@twenty-something/core";

/** A decoded friend challenge. */
export interface Challenge {
  /** Deterministic deal seed — re-deals the identical hands. */
  seed: string;
  variant: Variant;
  /** Number of hands in the challenge. */
  hands: number;
  /** The challenger's session star rating, 0–5. */
  rating: number;
  /** The challenger's display name (may be empty). */
  name: string;
}

/** Versioned prefix so a future format change can be detected, not mis-parsed. */
const PREFIX = "TS1";
const SEP = ".";

/** Bounds — kept in sync between encode (clamp) and decode (reject/clamp). */
const MAX_HANDS = 99;
const MAX_NAME = 16;
const MAX_RATING = 5;

const VARIANT_TO_CODE: Record<Variant, string> = { "24": "24", "20_something": "20" };
const CODE_TO_VARIANT: Record<string, Variant> = { "24": "24", "20": "20_something" };

/** Strip anything that would break the delimited format or bloat the code. */
function sanitizeName(name: string): string {
  return name
    .replace(/[.\n\r]/g, " ")
    .trim()
    .slice(0, MAX_NAME);
}

/** A random base36 deal seed. Impure (Math.random) — call it at the screen boundary. */
export function randomSeed(): string {
  return Math.random().toString(36).slice(2, 10);
}

/**
 * Encode a challenge into a compact, paste-safe code, e.g.
 * `TS1.20.k3f9q2z1.5.38.Riley`. Rating is stored as tenths (0–50) so the code
 * stays delimiter-clean. Inputs are clamped to valid ranges.
 */
export function encodeChallenge(c: Challenge): string {
  const v = VARIANT_TO_CODE[c.variant];
  const seed = c.seed.replace(/[^0-9a-z]/gi, "");
  const n = Math.max(1, Math.min(MAX_HANDS, Math.round(c.hands)));
  const r10 = Math.max(0, Math.min(MAX_RATING * 10, Math.round(c.rating * 10)));
  const name = sanitizeName(c.name);
  return [PREFIX, v, seed, n, r10, name].join(SEP);
}

/**
 * Decode a pasted code back into a Challenge, or null if it isn't a well-formed
 * one. Forgiving of surrounding whitespace; strict about structure so junk text
 * can't masquerade as a challenge. Out-of-range numbers are rejected.
 */
export function decodeChallenge(code: string): Challenge | null {
  if (typeof code !== "string") return null;
  const parts = code.trim().split(SEP);
  if (parts.length < 6) return null;
  const [prefix, v, seed, nStr, r10Str, ...nameParts] = parts;
  if (prefix !== PREFIX) return null;

  const variant = CODE_TO_VARIANT[v!];
  if (!variant) return null;
  if (!seed || !/^[0-9a-z]+$/i.test(seed)) return null;

  const n = Number(nStr);
  if (!Number.isInteger(n) || n < 1 || n > MAX_HANDS) return null;

  const r10 = Number(r10Str);
  if (!Number.isInteger(r10) || r10 < 0 || r10 > MAX_RATING * 10) return null;

  // The name is the remainder (rejoined defensively — sanitize stripped its
  // separators, but a hand-typed code might not have).
  const name = sanitizeName(nameParts.join(SEP));

  return { seed, variant, hands: n, rating: r10 / 10, name };
}

/** Head-to-head verdict from the recipient's point of view. */
export interface ChallengeOutcome {
  result: "win" | "loss" | "tie";
  /** Absolute rating gap between the two players. */
  diff: number;
}

/** Ratings within this gap are a tie (½ a tenth of a star — i.e. a rounding wash). */
const TIE_EPS = 0.05;

/** Compare the player's rating to the challenger's: did they win, lose, or tie? */
export function challengeOutcome(mine: number, theirs: number): ChallengeOutcome {
  const diff = mine - theirs;
  if (Math.abs(diff) < TIE_EPS) return { result: "tie", diff: 0 };
  return { result: diff > 0 ? "win" : "loss", diff: Math.abs(diff) };
}
