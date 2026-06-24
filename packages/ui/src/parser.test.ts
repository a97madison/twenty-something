import { test } from "node:test";
import assert from "node:assert/strict";

import {
  validateSolution,
  safeEvaluate,
  CLASSIC_OPERATIONS,
  type Hand,
} from "@twenty-something/core";

import { parseTokens, fillValues, type CheckerToken } from "./parser.ts";

// ---- token builders ------------------------------------------------------
// The checker UI emits CheckerToken[] as the user taps. These mirror that.
const card = (i: number): CheckerToken => ({ type: "card", i });
const o = (op: "+" | "-" | "×" | "÷"): CheckerToken => ({ type: "op", op });
const lp: CheckerToken = { type: "lp" };
const rp: CheckerToken = { type: "rp" };

// Build a hand with stable ids c0..c3 from four card values.
function makeHand(vals: number[]): Hand {
  return [
    { id: "c0", value: vals[0]! },
    { id: "c1", value: vals[1]! },
    { id: "c2", value: vals[2]! },
    { id: "c3", value: vals[3]! },
  ];
}

// Run a token sequence the way CheckerPane does: parse → fill real values →
// hand to core's validateSolution (the same authority the server uses).
function check(tokens: CheckerToken[], vals: number[], target: number) {
  const tree = parseTokens(tokens);
  if (!tree) return null;
  const expr = fillValues(tree, vals);
  return {
    expr,
    result: validateSolution(expr, {
      hand: makeHand(vals),
      target,
      operations: CLASSIC_OPERATIONS,
    }),
  };
}

// ---- valid solutions -----------------------------------------------------

test("a valid solution validates", () => {
  // 10 + 10 + 2 + 2 = 24
  const got = check([card(0), o("+"), card(1), o("+"), card(2), o("+"), card(3)], [10, 10, 2, 2], 24);
  assert.ok(got, "should parse");
  assert.deepEqual(got.result, { valid: true, value: 24 });
});

test("(7 + 5) × 2 - 3 makes 21 — parens are honored", () => {
  // The parenthesized form is the correct one for target 21.
  const got = check(
    [lp, card(0), o("+"), card(1), rp, o("×"), card(2), o("-"), card(3)],
    [7, 5, 2, 3],
    21,
  );
  assert.ok(got, "should parse");
  assert.deepEqual(got.result, { valid: true, value: 21 });
});

// ---- precedence (the key case) -------------------------------------------

test("7 + 5 × 2 - 3 is WRONG vs 21 — BEDMAS makes it 14, not 21", () => {
  // Without parens, × binds tighter: 7 + (5×2) - 3 = 14. Proves the parser
  // respects precedence rather than evaluating left-to-right (which gives 21).
  const got = check(
    [card(0), o("+"), card(1), o("×"), card(2), o("-"), card(3)],
    [7, 5, 2, 3],
    21,
  );
  assert.ok(got, "should parse");
  assert.equal(got.result.valid, false);
  assert.equal(safeEvaluate(got.expr), 14);
});

// ---- wrong cards ---------------------------------------------------------

test("reusing a card and dropping another is wrong_cards", () => {
  // Uses c0 twice and never uses c3.
  const got = check([card(0), o("+"), card(0), o("+"), card(1), o("+"), card(2)], [7, 5, 2, 3], 21);
  assert.ok(got, "should parse");
  assert.deepEqual(got.result, { valid: false, error: "wrong_cards" });
});

// ---- complete-but-wrong (value reported) ---------------------------------

test("a complete valid expression that misses the target reports its value", () => {
  // 7 × 5 - 2 - 3 = 30, all four cards used once, but target is 21.
  const got = check(
    [card(0), o("×"), card(1), o("-"), card(2), o("-"), card(3)],
    [7, 5, 2, 3],
    21,
  );
  assert.ok(got, "should parse");
  assert.deepEqual(got.result, { valid: false, error: "wrong_value" });
  assert.equal(safeEvaluate(got.expr), 30);
});

// ---- malformed input: null, never throws ---------------------------------

test("malformed token sequences return null and never throw", () => {
  const bad: CheckerToken[][] = [
    [lp, card(0), o("+"), card(1)], // unbalanced: no closing paren
    [card(0), o("+"), card(1), rp], // unbalanced: extra closing paren
    [card(0), card(1)], // two values with no operator between them
    [o("+"), card(0)], // leading operator
    [card(0), o("+")], // trailing operator (incomplete)
    [], // empty
  ];
  for (const tokens of bad) {
    assert.doesNotThrow(() => parseTokens(tokens));
    assert.equal(parseTokens(tokens), null, `expected null for ${JSON.stringify(tokens)}`);
  }
});
