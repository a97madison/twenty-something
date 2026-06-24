import type { Expr, Operation } from "@twenty-something/core";

import type { CheckerToken } from "../App";

/**
 * Shunting-yard parser: tokens → Expr tree, or null if malformed/incomplete.
 * This is checker-UI logic (the user builds an expression by tapping); the
 * resulting Expr is then handed to core's validateSolution for the verdict, so
 * the actual correctness judgment uses the same authority as the server.
 */
export function parseTokens(tokens: CheckerToken[]): Expr | null {
  const out: Expr[] = [];
  const ops: string[] = [];
  const prec: Record<string, number> = { "+": 1, "-": 1, "×": 2, "÷": 2 };
  const pop = () => {
    const op = ops.pop() as Operation;
    const r = out.pop();
    const l = out.pop();
    if (!l || !r) throw new Error("bad");
    out.push({ kind: "node", op, left: l, right: r });
  };
  try {
    let prev: string | null = null;
    for (const t of tokens) {
      if (t.type === "card") {
        if (prev === "val" || prev === "rp") throw new Error("bad");
        out.push({ kind: "leaf", cardId: `c${t.i}`, value: 0 }); // value filled below
        prev = "val";
      } else if (t.type === "op") {
        if (prev !== "val" && prev !== "rp") throw new Error("bad");
        while (ops.length && ops[ops.length - 1] !== "(" && prec[ops[ops.length - 1]!]! >= prec[t.op]!) pop();
        ops.push(t.op);
        prev = "op";
      } else if (t.type === "lp") {
        if (prev === "val" || prev === "rp") throw new Error("bad");
        ops.push("(");
        prev = "lp";
      } else {
        while (ops.length && ops[ops.length - 1] !== "(") pop();
        if (ops[ops.length - 1] !== "(") throw new Error("bad");
        ops.pop();
        prev = "rp";
      }
    }
    while (ops.length) {
      if (ops[ops.length - 1] === "(") throw new Error("bad");
      pop();
    }
    if (out.length !== 1) return null;
    return out[0]!;
  } catch {
    return null;
  }
}

/** Fill leaf values from the real card values (parser used placeholders). */
export function fillValues(expr: Expr, values: number[]): Expr {
  if (expr.kind === "leaf") {
    const i = Number(expr.cardId.slice(1));
    return { ...expr, value: values[i]! };
  }
  return {
    ...expr,
    left: fillValues(expr.left, values),
    right: fillValues(expr.right, values),
  };
}
