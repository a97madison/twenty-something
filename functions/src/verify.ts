/**
 * The shared scoring core. Both the daily handler and the room handler call
 * this. It is the ONE place client-submitted solutions are verified, so the
 * two callers can never drift apart on what counts as a valid solve.
 *
 * Critically: the Puzzle handed to validateSolution is rebuilt from the
 * SERVER's stored document, never from anything the client sent. The client
 * supplies only an expression; the cards, target, and allowed operations come
 * from Firestore. This is what makes the function authoritative.
 */

import {
  validateSolution,
  type Operation,
  type Puzzle,
} from "@twenty-something/core";

/** Minimal server-stored puzzle definition shared by daily and room docs. */
export interface StoredPuzzle {
  cards: { id: string; value: number }[];
  target: number;
  operations: Operation[];
}

export type VerifyResult =
  | { ok: true; value: number }
  | { ok: false; reason: string };

/**
 * Rebuild the authoritative Puzzle from a stored doc and validate `expr`
 * against it. `expr` is whatever the client sent — treated as untrusted
 * `unknown`, which validateSolution requires.
 */
export function verifySubmission(stored: StoredPuzzle, expr: unknown): VerifyResult {
  // A stored puzzle must have exactly four cards; guard against corrupt docs.
  if (!Array.isArray(stored.cards) || stored.cards.length !== 4) {
    return { ok: false, reason: "corrupt_puzzle" };
  }

  const puzzle: Puzzle = {
    hand: [
      stored.cards[0],
      stored.cards[1],
      stored.cards[2],
      stored.cards[3],
    ],
    target: stored.target,
    operations: stored.operations,
  };

  const result = validateSolution(expr, puzzle);
  if (result.valid) {
    return { ok: true, value: result.value };
  }
  return { ok: false, reason: result.error };
}
