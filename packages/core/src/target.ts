/**
 * Target computation — the ONLY place the two variants differ.
 * Everything downstream (evaluator, solver) is variant-agnostic; it just
 * receives a target number.
 */

import type { Hand, Variant } from "./types.ts";

/** Classic 24 always targets 24. */
export const CLASSIC_TARGET = 24;

/** 20-something base: target = BASE + value of the 4th (last-flipped) card. */
export const TWENTY_SOMETHING_BASE = 18;

/**
 * Compute the target for a hand under a given variant.
 *
 * - "24"            → always 24, regardless of cards.
 * - "20_something"  → 18 + the 4th card's value.
 *                     e.g. 4th card is a Jack (11) → 18 + 11 → 29.
 *
 * The "4th card" is hand[3] — callers must deal cards in flip order so the
 * last-flipped card sits at index 3.
 */
export function computeTarget(variant: Variant, hand: Hand): number {
  switch (variant) {
    case "24":
      return CLASSIC_TARGET;
    case "20_something":
      return TWENTY_SOMETHING_BASE + hand[3].value;
  }
}
