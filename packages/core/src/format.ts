/**
 * Formatter — render an expression tree as a readable infix string,
 * inserting parentheses only where precedence/associativity require them.
 * Used by the calculator display, the "reveal" hint, and shareable results.
 */

import type { Expr, Operation } from "./types.ts";

const PRECEDENCE: Record<Operation, number> = {
  "+": 1,
  "-": 1,
  "×": 2,
  "÷": 2,
};

/**
 * Format with minimal parentheses. A child is parenthesized when its operator
 * binds more loosely than the parent, or when associativity would otherwise
 * change the meaning (right child of − or ÷, equal-precedence cases).
 */
export function formatExpr(expr: Expr): string {
  if (expr.kind === "leaf") return String(expr.value);

  const parentPrec = PRECEDENCE[expr.op];
  const left = formatChild(expr.left, parentPrec, "left", expr.op);
  const right = formatChild(expr.right, parentPrec, "right", expr.op);
  return `${left} ${expr.op} ${right}`;
}

function formatChild(
  child: Expr,
  parentPrec: number,
  side: "left" | "right",
  parentOp: Operation,
): string {
  const inner = formatExpr(child);
  if (child.kind === "leaf") return inner;

  const childPrec = PRECEDENCE[child.op];
  let needsParens = childPrec < parentPrec;

  // Same precedence on the right of a non-associative op needs parens:
  // a - (b - c) ≠ a - b - c ; a ÷ (b ÷ c) ≠ a ÷ b ÷ c ; same for a-(b+c) etc.
  if (childPrec === parentPrec && side === "right") {
    if (parentOp === "-" || parentOp === "÷") needsParens = true;
  }

  return needsParens ? `(${inner})` : inner;
}
