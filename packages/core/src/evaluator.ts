/**
 * Evaluator — computes the value of an expression and validates that a
 * submitted expression is a legitimate solution to a puzzle.
 *
 * This is the AUTHORITY. The same function runs client-side (instant feedback)
 * and server-side (cheat-proof scoring). Trust nothing the client claims;
 * recompute from the expression tree.
 *
 * Arithmetic is done with exact rational numbers (numerator/denominator) so
 * that division is precise — 8 ÷ 3 × 3 must equal exactly 8, not 7.999999.
 * Floating point would silently break correctness checks.
 */

import type { Expr, Operation, Puzzle, Solution } from "./types.ts";

/** An exact rational n/d, always stored in lowest terms with d > 0. */
interface Rational {
  n: number; // numerator
  d: number; // denominator, always > 0
}

function gcd(a: number, b: number): number {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b) {
    [a, b] = [b, a % b];
  }
  return a || 1;
}

function rational(n: number, d: number): Rational {
  if (d === 0) throw new EvalError("Division by zero");
  if (d < 0) {
    n = -n;
    d = -d;
  }
  const g = gcd(n, d);
  return { n: n / g, d: d / g };
}

function applyOp(op: Operation, a: Rational, b: Rational): Rational {
  switch (op) {
    case "+":
      return rational(a.n * b.d + b.n * a.d, a.d * b.d);
    case "-":
      return rational(a.n * b.d - b.n * a.d, a.d * b.d);
    case "×":
      return rational(a.n * b.n, a.d * b.d);
    case "÷":
      if (b.n === 0) throw new EvalError("Division by zero");
      return rational(a.n * b.d, a.d * b.n);
  }
}

/** Thrown for illegal arithmetic (e.g. division by zero) during evaluation. */
export class EvalError extends Error {}

/**
 * Structural validation for untrusted input. At the server boundary an `Expr`
 * arrives as raw JSON, so we cannot assume it has the right shape. Returns true
 * only for a well-formed binary tree of leaves and ops. `unknown` in, because
 * the caller genuinely doesn't know yet.
 */
export function isWellFormedExpr(x: unknown): x is Expr {
  if (typeof x !== "object" || x === null) return false;
  const node = x as Record<string, unknown>;
  if (node.kind === "leaf") {
    return typeof node.cardId === "string" && typeof node.value === "number" &&
      Number.isFinite(node.value);
  }
  if (node.kind === "node") {
    return (
      (node.op === "+" || node.op === "-" || node.op === "×" || node.op === "÷") &&
      isWellFormedExpr(node.left) &&
      isWellFormedExpr(node.right)
    );
  }
  return false;
}

/** Recursively evaluate an expression tree to an exact rational. */
function evalRational(expr: Expr): Rational {
  if (expr.kind === "leaf") {
    return rational(expr.value, 1);
  }
  return applyOp(expr.op, evalRational(expr.left), evalRational(expr.right));
}

/**
 * Evaluate an expression to a JS number.
 * Throws EvalError on illegal arithmetic. Use `safeEvaluate` if you'd rather
 * get null than an exception.
 */
export function evaluate(expr: Expr): number {
  const r = evalRational(expr);
  return r.n / r.d;
}

/** Like `evaluate` but returns null instead of throwing. */
export function safeEvaluate(expr: Expr): number | null {
  try {
    return evaluate(expr);
  } catch {
    return null;
  }
}

/** Collect the card ids used by an expression's leaves. */
function leafCardIds(expr: Expr, acc: string[] = []): string[] {
  if (expr.kind === "leaf") {
    acc.push(expr.cardId);
  } else {
    leafCardIds(expr.left, acc);
    leafCardIds(expr.right, acc);
  }
  return acc;
}

/** Collect (id, value) pairs from an expression's leaves. */
function leafEntries(expr: Expr, acc: Array<{ id: string; value: number }> = []) {
  if (expr.kind === "leaf") {
    acc.push({ id: expr.cardId, value: expr.value });
  } else {
    leafEntries(expr.left, acc);
    leafEntries(expr.right, acc);
  }
  return acc;
}

/** Collect the operations used by an expression's nodes. */
function usedOperations(expr: Expr, acc: Operation[] = []): Operation[] {
  if (expr.kind === "node") {
    acc.push(expr.op);
    usedOperations(expr.left, acc);
    usedOperations(expr.right, acc);
  }
  return acc;
}

/** Why a submitted expression was rejected. */
export type ValidationError =
  | "malformed_expr" // not a structurally valid expression at all
  | "wrong_cards" // didn't use exactly the puzzle's four cards, each once
  | "forged_value" // a leaf's value doesn't match that card's real value
  | "illegal_operation" // used an op not in the puzzle's allowed set
  | "illegal_arithmetic" // division by zero etc.
  | "wrong_value"; // evaluates, but not to the target

export type ValidationResult =
  | { valid: true; value: number }
  | { valid: false; error: ValidationError };

/**
 * THE gatekeeper. Verify that `expr` is a legitimate solution to `puzzle`:
 *   0. is a structurally well-formed expression (untrusted JSON-safe),
 *   1. uses exactly the puzzle's four card ids, each exactly once,
 *   2. each leaf's value matches that card's real value (no forging),
 *   3. uses only allowed operations,
 *   4. evaluates without illegal arithmetic,
 *   5. equals the target (exactly, via rational comparison).
 *
 * Used identically on client and server. The server treats its result as
 * final; it never trusts a client-reported "I solved it". Accepts `unknown`
 * because at the server boundary the input is untrusted JSON.
 */
export function validateSolution(expr: unknown, puzzle: Puzzle): ValidationResult {
  // 0. structural guard — never throw on malformed attacker-controlled input.
  if (!isWellFormedExpr(expr)) {
    return { valid: false, error: "malformed_expr" };
  }

  // 1. exact card multiset match (by id)
  const used = leafCardIds(expr).sort();
  const expected = puzzle.hand.map((c) => c.id).sort();
  if (used.length !== expected.length || used.some((id, i) => id !== expected[i])) {
    return { valid: false, error: "wrong_cards" };
  }

  // 2. each leaf's value must match the real value of the card it claims to be.
  // Without this, a client could submit the right card ids with forged values.
  const realValue = new Map(puzzle.hand.map((c) => [c.id, c.value]));
  for (const { id, value } of leafEntries(expr)) {
    if (realValue.get(id) !== value) {
      return { valid: false, error: "forged_value" };
    }
  }

  // 3. operations must be within the allowed set for this puzzle
  const allowed = new Set(puzzle.operations);
  if (usedOperations(expr).some((op) => !allowed.has(op))) {
    return { valid: false, error: "illegal_operation" };
  }

  // 4 + 5. evaluate exactly and compare to target
  let result: Rational;
  try {
    result = evalRational(expr);
  } catch {
    return { valid: false, error: "illegal_arithmetic" };
  }
  // exact equality: result == target  ⇔  result.n == target * result.d
  if (result.n === puzzle.target * result.d) {
    return { valid: true, value: result.n / result.d };
  }
  return { valid: false, error: "wrong_value" };
}

/** Convenience: turn a validated expression into a Solution record. */
export function toSolution(expr: Expr): Solution {
  return { expr, value: evaluate(expr) };
}
