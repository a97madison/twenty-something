/**
 * Solver — given a puzzle, find solution expressions.
 *
 * Strategy: build every possible expression tree from the cards using the
 * allowed operations, evaluate each, keep the ones that hit the target.
 *
 * With four cards this space is tiny (a few thousand trees), so exhaustive
 * search is instant and always correct — no heuristics, no missed solutions.
 * The same approach scales fine if you ever allow more or fewer cards.
 *
 * Powers:
 *   - the calculator app (show all / first solution),
 *   - unsolvable-hand detection (don't deal a hand with no solution),
 *   - the metered "reveal" hint in the game.
 */

import type { Card, Expr, Operation, Puzzle, Solution } from "./types.ts";
import { safeEvaluate } from "./evaluator.ts";

/** A subexpression paired with the set of card ids it consumes. */
interface Partial {
  expr: Expr;
  used: Set<string>;
}

function leaf(card: Card): Partial {
  return {
    expr: { kind: "leaf", cardId: card.id, value: card.value },
    used: new Set([card.id]),
  };
}

function combine(a: Partial, b: Partial, op: Operation): Partial {
  return {
    expr: { kind: "node", op, left: a.expr, right: b.expr },
    used: new Set([...a.used, ...b.used]),
  };
}

/**
 * Build every expression over a set of cards, using the allowed operations.
 *
 * Recursive subset partition: for a set of cards, either it's a single leaf,
 * or it splits into a non-empty left subset and its complement. Recurse on
 * each side, then combine every left-subexpression with every right-sub-
 * expression under every allowed operation. This enumerates every distinct
 * parenthesization and ordering, so no solution is ever missed — including
 * ones that pass through non-integer intermediates like 8 ÷ (3 − 8 ÷ 3).
 *
 * Both (a op b) and (b op a) arise naturally because every ordered split of
 * the set is considered, which matters for the non-commutative ops − and ÷.
 *
 * Memoized on the card-id subset so shared subproblems are built once.
 */
function buildAll(cards: readonly Card[], operations: readonly Operation[]): Expr[] {
  const memo = new Map<string, Partial[]>();

  function build(subset: Card[]): Partial[] {
    const key = subset.map((c) => c.id).sort().join(",");
    const cached = memo.get(key);
    if (cached) return cached;

    let result: Partial[];
    if (subset.length === 1) {
      const only = subset[0]!;
      result = [leaf(only)];
    } else {
      result = [];
      // Enumerate every way to split `subset` into a non-empty proper subset
      // `left` and its complement `right`, via bitmask over the cards.
      const n = subset.length;
      for (let mask = 1; mask < (1 << n) - 1; mask++) {
        const left: Card[] = [];
        const right: Card[] = [];
        for (let k = 0; k < n; k++) {
          const card = subset[k]!;
          (mask & (1 << k) ? left : right).push(card);
        }
        const leftExprs = build(left);
        const rightExprs = build(right);
        for (const a of leftExprs) {
          for (const b of rightExprs) {
            for (const op of operations) {
              result.push(combine(a, b, op));
            }
          }
        }
      }
    }
    memo.set(key, result);
    return result;
  }

  const full = build([...cards]);
  // Dedupe structurally-identical trees.
  const seen = new Set<string>();
  const exprs: Expr[] = [];
  for (const p of full) {
    const k = exprKey(p.expr);
    if (seen.has(k)) continue;
    seen.add(k);
    exprs.push(p.expr);
  }
  return exprs;
}

/** Stable string key for an expression tree, for deduplication. */
function exprKey(expr: Expr): string {
  if (expr.kind === "leaf") return `#${expr.cardId}`;
  return `(${exprKey(expr.left)}${expr.op}${exprKey(expr.right)})`;
}

/**
 * Find ALL solutions to a puzzle. Each distinct expression tree that hits the
 * target is returned once. May include arithmetically-equivalent-looking forms
 * that are structurally different (e.g. a+b vs b+a) — see `findFirstSolution`
 * if you only need one.
 */
export function findAllSolutions(puzzle: Puzzle): Solution[] {
  const exprs = buildAll(puzzle.hand, puzzle.operations);
  const solutions: Solution[] = [];
  for (const expr of exprs) {
    const value = safeEvaluate(expr);
    if (value !== null && isTarget(value, puzzle.target)) {
      solutions.push({ expr, value });
    }
  }
  return solutions;
}

/** Find one solution, or null if the puzzle is unsolvable. Fast path. */
export function findFirstSolution(puzzle: Puzzle): Solution | null {
  const exprs = buildAll(puzzle.hand, puzzle.operations);
  for (const expr of exprs) {
    const value = safeEvaluate(expr);
    if (value !== null && isTarget(value, puzzle.target)) {
      return { expr, value };
    }
  }
  return null;
}

/** Is this hand solvable at all under the given puzzle rules? */
export function isSolvable(puzzle: Puzzle): boolean {
  return findFirstSolution(puzzle) !== null;
}

/** Tolerant equality (values come back through float division). */
function isTarget(value: number, target: number): boolean {
  return Math.abs(value - target) < 1e-9;
}
