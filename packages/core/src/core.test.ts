import { test } from "node:test";
import assert from "node:assert/strict";

import {
  CLASSIC_OPERATIONS,
  computeTarget,
  evaluate,
  findAllSolutions,
  findFirstSolution,
  formatExpr,
  isSolvable,
  validateSolution,
  type Card,
  type Expr,
  type Hand,
  type Puzzle,
} from "./index.ts";

// Helper: build a hand from four values with stable ids.
function hand(a: number, b: number, c: number, d: number): Hand {
  return [
    { id: "c0", value: a },
    { id: "c1", value: b },
    { id: "c2", value: c },
    { id: "c3", value: d },
  ];
}

function puzzle(h: Hand, target: number): Puzzle {
  return { hand: h, target, operations: CLASSIC_OPERATIONS };
}

// ---- target logic --------------------------------------------------------

test("classic 24 always targets 24", () => {
  assert.equal(computeTarget("24", hand(1, 2, 3, 4)), 24);
  assert.equal(computeTarget("24", hand(13, 13, 13, 13)), 24);
});

test("20-something targets 18 + the 4th card", () => {
  assert.equal(computeTarget("20_something", hand(7, 4, 2, 3)), 21); // 18+3
  assert.equal(computeTarget("20_something", hand(7, 4, 2, 11)), 29); // jack
  assert.equal(computeTarget("20_something", hand(1, 1, 1, 6)), 24); // 18+6
});

// ---- evaluator: exact rational arithmetic --------------------------------

test("division is exact, not floating point", () => {
  // (8 ÷ 3) × 3 must be exactly 8
  const expr: Expr = {
    kind: "node",
    op: "×",
    left: {
      kind: "node",
      op: "÷",
      left: { kind: "leaf", cardId: "c0", value: 8 },
      right: { kind: "leaf", cardId: "c1", value: 3 },
    },
    right: { kind: "leaf", cardId: "c2", value: 3 },
  };
  assert.equal(evaluate(expr), 8);
});

// ---- validation: the gatekeeper ------------------------------------------

test("validateSolution accepts a correct solution", () => {
  // 4 × 6 × (3 - 2) = 24 using values 4,6,3,2
  const h = hand(4, 6, 3, 2);
  const expr: Expr = {
    kind: "node",
    op: "×",
    left: {
      kind: "node",
      op: "×",
      left: { kind: "leaf", cardId: "c0", value: 4 },
      right: { kind: "leaf", cardId: "c1", value: 6 },
    },
    right: {
      kind: "node",
      op: "-",
      left: { kind: "leaf", cardId: "c2", value: 3 },
      right: { kind: "leaf", cardId: "c3", value: 2 },
    },
  };
  const r = validateSolution(expr, puzzle(h, 24));
  assert.equal(r.valid, true);
});

test("validateSolution rejects reusing a card / wrong card set", () => {
  const h = hand(4, 6, 3, 2);
  // uses c0 twice, never uses c3
  const expr: Expr = {
    kind: "node",
    op: "+",
    left: {
      kind: "node",
      op: "+",
      left: { kind: "leaf", cardId: "c0", value: 4 },
      right: { kind: "leaf", cardId: "c0", value: 4 },
    },
    right: {
      kind: "node",
      op: "+",
      left: { kind: "leaf", cardId: "c1", value: 6 },
      right: { kind: "leaf", cardId: "c2", value: 3 },
    },
  };
  const r = validateSolution(expr, puzzle(h, 24));
  assert.equal(r.valid, false);
  if (!r.valid) assert.equal(r.error, "wrong_cards");
});

test("validateSolution rejects malformed expression input without throwing", () => {
  const h = hand(4, 6, 3, 2);
  const p = puzzle(h, 24);
  // shapes a hostile client might POST as JSON
  const malformed: unknown[] = [
    null,
    {},
    { kind: "node", op: "+", left: { kind: "leaf", cardId: "c0", value: 4 } }, // missing right
    { kind: "leaf", cardId: "c0" }, // missing value
    { kind: "node", op: "^", left: null, right: null }, // bad op
    { kind: "wat" },
  ];
  for (const bad of malformed) {
    const r = validateSolution(bad, p);
    assert.equal(r.valid, false);
    if (!r.valid) assert.equal(r.error, "malformed_expr");
  }
});

test("validateSolution rejects a forged leaf value", () => {
  // correct card ids, but c0's value is forged from 4 to 20 to cheat the target
  const h = hand(4, 6, 3, 2);
  const forged: Expr = {
    kind: "node",
    op: "+",
    left: {
      kind: "node",
      op: "+",
      left: { kind: "leaf", cardId: "c0", value: 20 }, // real value is 4
      right: { kind: "leaf", cardId: "c1", value: 6 },
    },
    right: {
      kind: "node",
      op: "-",
      left: { kind: "leaf", cardId: "c2", value: 3 },
      right: { kind: "leaf", cardId: "c3", value: 2 },
    },
  };
  const r = validateSolution(forged, puzzle(h, 24));
  assert.equal(r.valid, false);
  if (!r.valid) assert.equal(r.error, "forged_value");
});

test("validateSolution rejects an operation outside the allowed set", () => {
  const h = hand(4, 6, 3, 2);
  // correct cards but uses ÷ when only + is allowed
  const restricted: Puzzle = { hand: h, target: 24, operations: ["+"] };
  const expr: Expr = {
    kind: "node",
    op: "÷",
    left: { kind: "leaf", cardId: "c0", value: 4 },
    right: {
      kind: "node",
      op: "+",
      left: { kind: "leaf", cardId: "c1", value: 6 },
      right: {
        kind: "node",
        op: "+",
        left: { kind: "leaf", cardId: "c2", value: 3 },
        right: { kind: "leaf", cardId: "c3", value: 2 },
      },
    },
  };
  const r = validateSolution(expr, restricted);
  assert.equal(r.valid, false);
  if (!r.valid) assert.equal(r.error, "illegal_operation");
});

// ---- solver --------------------------------------------------------------

test("solver finds a known classic solution", () => {
  // 3,3,8,8 → 8 ÷ (3 - 8 ÷ 3) = 24, a famously tricky hand
  const sol = findFirstSolution(puzzle(hand(3, 3, 8, 8), 24));
  assert.ok(sol, "expected a solution for 3,3,8,8 → 24");
});

test("solver reports unsolvable hands", () => {
  // 1,1,1,1 cannot reach 24 with + - × ÷
  assert.equal(isSolvable(puzzle(hand(1, 1, 1, 1), 24)), false);
});

test("solver solves a 20-something hand against its dynamic target", () => {
  const h = hand(7, 4, 2, 3); // target = 18 + 3 = 21
  const t = computeTarget("20_something", h);
  const sol = findFirstSolution(puzzle(h, t));
  assert.ok(sol, `expected a solution for 7,4,2,3 → ${t}`);
});

test("operation set genuinely restricts the search", () => {
  // 6,6,6,6: 6+6+6+6 = 24 with only +
  const addOnly: Puzzle = { hand: hand(6, 6, 6, 6), target: 24, operations: ["+"] };
  assert.ok(findFirstSolution(addOnly), "6+6+6+6 should solve with + only");

  // 2,2,2,3 cannot reach 24 with + alone, but can with ×: (2+2)... actually
  // 2×2×2×3 = 24 needs ×; with + only it's impossible (max 9)
  const addOnlyImpossible: Puzzle = {
    hand: hand(2, 2, 2, 3),
    target: 24,
    operations: ["+"],
  };
  assert.equal(findFirstSolution(addOnlyImpossible), null);
  const withMul: Puzzle = {
    hand: hand(2, 2, 2, 3),
    target: 24,
    operations: ["+", "×"],
  };
  assert.ok(findFirstSolution(withMul), "2×2×2×3 should solve with × allowed");
});

// ---- formatter -----------------------------------------------------------

test("formatter inserts parens only where needed", () => {
  // a - (b - c) must keep its parens; a - b - c must not gain any
  const needsParens: Expr = {
    kind: "node",
    op: "-",
    left: { kind: "leaf", cardId: "c0", value: 10 },
    right: {
      kind: "node",
      op: "-",
      left: { kind: "leaf", cardId: "c1", value: 5 },
      right: { kind: "leaf", cardId: "c2", value: 2 },
    },
  };
  assert.equal(formatExpr(needsParens), "10 - (5 - 2)");

  const noParens: Expr = {
    kind: "node",
    op: "+",
    left: {
      kind: "node",
      op: "×",
      left: { kind: "leaf", cardId: "c0", value: 7 },
      right: { kind: "leaf", cardId: "c1", value: 4 },
    },
    right: { kind: "leaf", cardId: "c2", value: 2 },
  };
  assert.equal(formatExpr(noParens), "7 × 4 + 2");
});

// ---- sanity: every solver solution actually validates ---------------------

test("every solution the solver returns passes validation", () => {
  const p = puzzle(hand(4, 6, 3, 2), 24);
  const sols = findAllSolutions(p);
  assert.ok(sols.length > 0);
  for (const s of sols) {
    const r = validateSolution(s.expr, p);
    assert.equal(r.valid, true);
  }
});
