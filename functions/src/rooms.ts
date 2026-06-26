/**
 * Server-side round dealing for live rooms. Unlike the single-player "judge the
 * hand" model, a race needs a GUARANTEED-solvable hand (you want a winner), so we
 * generate values and reject until core's solver confirms a solution exists. Pure
 * given an injected rng, so it's deterministic in tests; the callable passes
 * Math.random. core is the one authority on solvability — the same module the
 * client and the daily use.
 */

import {
  computeTarget,
  isSolvable,
  CLASSIC_OPERATIONS,
  type Hand,
  type Operation,
  type Variant,
} from "@twenty-something/core";

export interface DealtRound {
  cards: { id: string; value: number }[];
  target: number;
  operations: Operation[];
}

const IDS = ["c0", "c1", "c2", "c3"] as const;

function handFrom(values: number[]): Hand {
  return [
    { id: IDS[0], value: values[0]! },
    { id: IDS[1], value: values[1]! },
    { id: IDS[2], value: values[2]! },
    { id: IDS[3], value: values[3]! },
  ];
}

/**
 * Deal one guaranteed-solvable round for `variant`. Rejection-samples natural
 * hands until core says one is solvable (almost always the first few tries).
 */
export function dealSolvableRound(variant: Variant, rng: () => number): DealtRound {
  for (let i = 0; i < 1000; i++) {
    const values = Array.from({ length: 4 }, () => 1 + Math.floor(rng() * 13));
    const hand = handFrom(values);
    const target = computeTarget(variant, hand);
    if (isSolvable({ hand, target, operations: CLASSIC_OPERATIONS })) {
      return {
        cards: hand.map((c) => ({ id: c.id, value: c.value })),
        target,
        operations: [...CLASSIC_OPERATIONS],
      };
    }
  }
  // Statistically unreachable (solvable hands are common); a safe known-solvable
  // fallback keeps the function total rather than throwing inside a transaction.
  const hand = handFrom([6, 6, 6, 6]); // 6+6+6+6 = 24, and 18+6=24 for 20-something
  return {
    cards: hand.map((c) => ({ id: c.id, value: c.value })),
    target: computeTarget(variant, hand),
    operations: [...CLASSIC_OPERATIONS],
  };
}

/** A short, unambiguous room code (no vowels/look-alikes), from an rng. */
export function makeRoomCode(rng: () => number, len = 4): string {
  const alphabet = "BCDFGHJKLMNPQRSTVWXYZ23456789"; // no vowels (no words), no 0/1/O/I
  let code = "";
  for (let i = 0; i < len; i++) code += alphabet[Math.floor(rng() * alphabet.length)];
  return code;
}

/** Clamp the match's winning score into a sane range (default 3). */
export function sanitizeWinningScore(x: unknown): number {
  const n = typeof x === "number" && Number.isFinite(x) ? Math.floor(x) : 3;
  return Math.max(1, Math.min(20, n));
}

/** Clamp a round's countdown seconds (0 = untimed; default 0, max 10 min). */
export function sanitizeDuration(x: unknown): number {
  const n = typeof x === "number" && Number.isFinite(x) ? Math.floor(x) : 0;
  return Math.max(0, Math.min(600, n));
}
