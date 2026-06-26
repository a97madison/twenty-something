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
  /** Stable per-device id of the challenger — identifies a "specific friend" for
   *  the head-to-head record, robust to renames. Absent in legacy (TS1) codes. */
  playerId?: string;
}

/** Versioned prefixes. TS2 adds the challenger's playerId; TS1 is still decoded. */
const PREFIX_V2 = "TS2";
const PREFIX_V1 = "TS1";
const SEP = ".";

/** Bounds — kept in sync between encode (clamp) and decode (reject/clamp). */
const MAX_HANDS = 99;
const MAX_NAME = 16;
const MAX_RATING = 5;
const MAX_ID = 12;

const VARIANT_TO_CODE: Record<Variant, string> = { "24": "24", "20_something": "20" };
const CODE_TO_VARIANT: Record<string, Variant> = { "24": "24", "20": "20_something" };

// A basic blocklist (lowercased, leet-normalized) so a friend's display name —
// which renders on YOUR screen — can't be a slur or hard profanity. Not
// exhaustive moderation; it blanks the worst, gracefully (→ "Anonymous").
// Longer/unambiguous terms only — short substrings like "dick"/"fag"/"spic"
// would false-positive real names (Dickson, Fagan, Spicer), so they're omitted.
const BLOCKED = [
  "fuck", "shit", "cunt", "bitch", "pussy", "nigger", "nigga", "faggot",
  "retard", "whore", "kike", "tranny",
];

/** Lower + collapse common leetspeak so "n1gg3r" matches "nigger". */
function normalizeForMatch(s: string): string {
  return s
    .toLowerCase()
    .replace(/0/g, "o")
    .replace(/1/g, "i")
    .replace(/3/g, "e")
    .replace(/4/g, "a")
    .replace(/5/g, "s")
    .replace(/7/g, "t")
    .replace(/[^a-z]/g, "");
}

function isBlockedName(name: string): boolean {
  const n = normalizeForMatch(name);
  return BLOCKED.some((b) => n.includes(b));
}

/** Strip delimiter-breaking chars, cap length, and blank obviously offensive names. */
function sanitizeName(name: string): string {
  const clean = name.replace(/[.\n\r]/g, " ").trim().slice(0, MAX_NAME);
  return isBlockedName(clean) ? "" : clean;
}

/** Strip a base36 id field to its safe charset, capped. */
function sanitizeId(id: string): string {
  return id.replace(/[^0-9a-z]/gi, "").slice(0, MAX_ID);
}

/** A random base36 deal seed. Impure (Math.random) — call it at the screen boundary. */
export function randomSeed(): string {
  return Math.random().toString(36).slice(2, 10);
}

/** A random stable per-device player id. Impure — generate once, then persist. */
export function randomPlayerId(): string {
  return (Math.random().toString(36).slice(2, 8) + Math.random().toString(36).slice(2, 6)).slice(0, MAX_ID);
}

/**
 * Encode a challenge into a compact, paste-safe code, e.g.
 * `TS2.20.k3f9q2z1.5.38.ab12cd.Riley` — version, variant, seed, hands, rating
 * (tenths), the challenger's playerId, then their name. Inputs are clamped.
 */
export function encodeChallenge(c: Challenge): string {
  const v = VARIANT_TO_CODE[c.variant];
  const seed = c.seed.replace(/[^0-9a-z]/gi, "");
  const n = Math.max(1, Math.min(MAX_HANDS, Math.round(c.hands)));
  const r10 = Math.max(0, Math.min(MAX_RATING * 10, Math.round(c.rating * 10)));
  const id = sanitizeId(c.playerId ?? "");
  const name = sanitizeName(c.name);
  return [PREFIX_V2, v, seed, n, r10, id, name].join(SEP);
}

/**
 * Decode a pasted code back into a Challenge, or null if it isn't a well-formed
 * one. Accepts both TS2 (with playerId) and legacy TS1 (no playerId). Forgiving
 * of surrounding whitespace; strict about structure so junk can't masquerade as
 * a challenge. Out-of-range numbers are rejected.
 */
export function decodeChallenge(code: string): Challenge | null {
  if (typeof code !== "string") return null;
  const parts = code.trim().split(SEP);
  const prefix = parts[0];
  const v2 = prefix === PREFIX_V2;
  if (!v2 && prefix !== PREFIX_V1) return null;
  if (parts.length < (v2 ? 7 : 6)) return null;

  const [, v, seed, nStr, r10Str] = parts;
  const variant = CODE_TO_VARIANT[v!];
  if (!variant) return null;
  if (!seed || !/^[0-9a-z]+$/i.test(seed)) return null;

  const n = Number(nStr);
  if (!Number.isInteger(n) || n < 1 || n > MAX_HANDS) return null;

  const r10 = Number(r10Str);
  if (!Number.isInteger(r10) || r10 < 0 || r10 > MAX_RATING * 10) return null;

  // TS2: index 5 is the playerId, the name is the remainder. TS1: no id field.
  const playerId = v2 ? sanitizeId(parts[5] ?? "") : "";
  const name = sanitizeName(parts.slice(v2 ? 6 : 5).join(SEP));

  return { seed, variant, hands: n, rating: r10 / 10, name, ...(playerId ? { playerId } : {}) };
}

// --- Shareable links ----------------------------------------------------------
//
// A tappable URL beats "paste this weird code": a friend taps it and lands
// straight in the accept flow (in-browser on the web build; via the app's deep
// link on native). The code rides in a `c=` query param so it works at any host.

/** Brandable base for challenge links (point this at the deployed web app). */
export const CHALLENGE_URL_BASE = "https://twentysomething.app";

/** Build a shareable challenge link from a code. */
export function challengeUrl(code: string): string {
  return `${CHALLENGE_URL_BASE}/?c=${encodeURIComponent(code)}`;
}

/**
 * Pull a challenge code out of pasted text — a full link (`…?c=CODE`) or a bare
 * code. Returns the raw code string (still run it through `decodeChallenge` to
 * validate), or null if there's nothing code-shaped.
 */
export function extractChallengeCode(input: string): string | null {
  if (typeof input !== "string") return null;
  const s = input.trim();
  const m = s.match(/[?&]c=([^&\s]+)/);
  if (m) return decodeURIComponent(m[1]!);
  return /^TS\d\./.test(s) ? s : null;
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
