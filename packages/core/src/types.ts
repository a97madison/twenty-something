/**
 * Core types — the shared vocabulary used by the app, the calculator,
 * and the server-side Cloud Functions. Pure data, no behavior.
 */

/** The four binary operations. Unary ops are intentionally excluded. */
export type Operation = "+" | "-" | "×" | "÷";

/** The full classic operation set. v1 default. */
export const CLASSIC_OPERATIONS: readonly Operation[] = ["+", "-", "×", "÷"];

/**
 * A card's numeric value as used in arithmetic.
 * Ace = 1, number cards = face value, J = 11, Q = 12, K = 13.
 * (Face-card valuation is a display concern; core only deals in values.)
 */
export type CardValue = number;

/**
 * A single card. `id` distinguishes two cards of the same value so we can
 * enforce "each card used exactly once" even when values collide (e.g. two 7s).
 */
export interface Card {
  id: string;
  value: CardValue;
}

/** A hand is always exactly four cards. */
export type Hand = readonly [Card, Card, Card, Card];

/** Which game is being played. */
export type Variant = "24" | "20_something";

/**
 * An expression is a binary tree. A leaf is one card's value; an internal
 * node combines two sub-expressions with an operation. Because every op is
 * binary, four leaves always combine through exactly three internal nodes.
 */
export type Expr =
  | { kind: "leaf"; cardId: string; value: CardValue }
  | { kind: "node"; op: Operation; left: Expr; right: Expr };

/** A fully-specified puzzle: the cards to use and the number to reach. */
export interface Puzzle {
  hand: Hand;
  target: number;
  /** The operations allowed for THIS puzzle. Passed in, never hard-coded. */
  operations: readonly Operation[];
}

/** A solution: an expression plus the value it evaluates to (== target). */
export interface Solution {
  expr: Expr;
  value: number;
}
