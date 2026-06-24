/**
 * Canonical form — collapse expressions that differ only by commuting or
 * re-associating + and ×, so the solver's "show all solutions" list doesn't
 * repeat the same idea many times (e.g. `6 + (1 + 12÷4)` and
 * `6 + (12÷4 + 1)` are one solution, not two).
 *
 * Scope is deliberately SYNTACTIC, not algebraic:
 *   - + and × are commutative AND associative → operands of a same-op chain
 *     are flattened and sorted, so order and grouping stop mattering.
 *   - − and ÷ are NOT commutative → their structure is preserved exactly
 *     (a − b stays distinct from b − a).
 *   - Distributive rearrangements are LEFT ALONE on purpose: a × (b + c) and
 *     a × b + a × c are different *methods* and both deserve to be shown.
 *
 * Leaves are keyed by VALUE (not card id): two cards of the same rank render
 * identically, so they should dedupe like the display does.
 */

import type { Expr, Operation, Solution } from "./types.ts";
import { formatExpr } from "./format.ts";

const COMMUTATIVE: Record<Operation, boolean> = {
  "+": true,
  "-": false,
  "×": true,
  "÷": false,
};

/** Collect the operands of a maximal chain of the same commutative op. */
function flatten(expr: Expr, op: Operation, out: Expr[]): void {
  if (expr.kind === "node" && expr.op === op) {
    flatten(expr.left, op, out);
    flatten(expr.right, op, out);
  } else {
    out.push(expr);
  }
}

/**
 * A string key that is identical for any two expressions equal under
 * commutativity/associativity of + and ×, and different otherwise.
 */
export function canonicalKey(expr: Expr): string {
  if (expr.kind === "leaf") return String(expr.value);
  if (COMMUTATIVE[expr.op]) {
    const operands: Expr[] = [];
    flatten(expr, expr.op, operands);
    const keys = operands.map(canonicalKey).sort();
    return `(${keys.join(expr.op)})`;
  }
  return `(${canonicalKey(expr.left)}${expr.op}${canonicalKey(expr.right)})`;
}

/**
 * Drop solutions that are the same as an earlier one, keeping the first
 * occurrence of each. Order is otherwise preserved.
 *
 * Two filters run together, because neither alone is enough:
 *   - canonical key collapses commutative/associative + and × reorderings
 *     (which render as DIFFERENT strings, e.g. `1 + 2 + 3` vs `3 + 2 + 1`).
 *   - displayed string collapses structurally-different trees that render
 *     IDENTICALLY, because `formatExpr` drops parens that are redundant for a
 *     same-precedence ×/÷ chain — so `((2×3×4)÷1)`, `((4÷1)×2×3)` and
 *     `(((3×4)÷1)×2)` all print as `2 × 3 × 4 ÷ 1` despite distinct keys.
 * Keeping a solution only when BOTH its key and its text are new guarantees
 * the list has no commutative twins AND no visually-identical rows.
 */
export function dedupeSolutions(solutions: readonly Solution[]): Solution[] {
  const seenKey = new Set<string>();
  const seenText = new Set<string>();
  const out: Solution[] = [];
  for (const s of solutions) {
    const key = canonicalKey(s.expr);
    const text = formatExpr(s.expr);
    if (seenKey.has(key) || seenText.has(text)) continue;
    seenKey.add(key);
    seenText.add(text);
    out.push(s);
  }
  return out;
}
