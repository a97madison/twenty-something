import { test } from "node:test";
import assert from "node:assert/strict";

import {
  canonicalKey,
  dedupeSolutions,
  type Expr,
  type Operation,
  type Solution,
} from "./index.ts";

// Tiny Expr builders so the trees in these tests read like math.
const n = (value: number): Expr => ({ kind: "leaf", cardId: `v${value}`, value });
const op = (o: Operation) => (left: Expr, right: Expr): Expr => ({ kind: "node", op: o, left, right });
const add = op("+");
const sub = op("-");
const mul = op("×");
const div = op("÷");

const sol = (expr: Expr): Solution => ({ expr, value: 0 });

test("commutativity: a + b and b + a share a key", () => {
  assert.equal(canonicalKey(add(n(2), n(3))), canonicalKey(add(n(3), n(2))));
});

test("commutativity: a × b and b × a share a key", () => {
  assert.equal(canonicalKey(mul(n(2), n(3))), canonicalKey(mul(n(3), n(2))));
});

test("associativity: (a + b) + c and a + (b + c) share a key", () => {
  assert.equal(
    canonicalKey(add(add(n(1), n(2)), n(3))),
    canonicalKey(add(n(1), add(n(2), n(3)))),
  );
});

test("the motivating case: 6 + (1 + 12÷4) == 6 + (12÷4 + 1)", () => {
  const a = add(n(6), add(n(1), div(n(12), n(4))));
  const b = add(n(6), add(div(n(12), n(4)), n(1)));
  assert.equal(canonicalKey(a), canonicalKey(b));
});

test("subtraction is NOT commutative: a − b ≠ b − a", () => {
  assert.notEqual(canonicalKey(sub(n(5), n(3))), canonicalKey(sub(n(3), n(5))));
});

test("division is NOT commutative: a ÷ b ≠ b ÷ a", () => {
  assert.notEqual(canonicalKey(div(n(8), n(2))), canonicalKey(div(n(2), n(8))));
});

test("distributive forms stay distinct: a×(b+c) ≠ a×b + a×c", () => {
  const factored = mul(n(2), add(n(3), n(4)));
  const expanded = add(mul(n(2), n(3)), mul(n(2), n(4)));
  assert.notEqual(canonicalKey(factored), canonicalKey(expanded));
});

test("dedupeSolutions collapses commutative twins, keeps the first", () => {
  const first = sol(add(n(1), div(n(12), n(4))));
  const twin = sol(add(div(n(12), n(4)), n(1)));
  const distinct = sol(sub(n(12), n(4)));
  const out = dedupeSolutions([first, twin, distinct]);
  assert.equal(out.length, 2);
  assert.equal(out[0], first); // first occurrence kept, not the twin
  assert.equal(out[1], distinct);
});
