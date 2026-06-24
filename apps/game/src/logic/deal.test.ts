import { test } from "node:test";
import assert from "node:assert/strict";

import { isSolvable, computeTarget, CLASSIC_OPERATIONS } from "@twenty-something/core";
import { dealSolvableHand } from "./engine.ts";

// Deterministic PRNG so "random" deals are reproducible in tests.
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// An rng that returns a fixed queue of draws, then throws — for forcing a
// specific deal sequence (each attempt consumes 4 value draws + 4 suit draws).
function queuedRng(draws: number[]): () => number {
  let i = 0;
  return () => {
    if (i >= draws.length) throw new Error("queuedRng exhausted");
    return draws[i++]!;
  };
}

test("only ever deals solvable hands (both variants)", () => {
  const rng = mulberry32(12345);
  for (let i = 0; i < 200; i++) {
    for (const variant of ["24", "20_something"] as const) {
      const dealt = dealSolvableHand(variant, rng);
      assert.ok(
        isSolvable({ hand: dealt.hand, target: dealt.target, operations: CLASSIC_OPERATIONS }),
        `dealt an unsolvable ${variant} hand: ${dealt.values}`,
      );
    }
  }
});

test("hand has ids c0..c3 and values/suits in range", () => {
  const dealt = dealSolvableHand("24", mulberry32(7));
  assert.equal(dealt.values.length, 4);
  assert.equal(dealt.suits.length, 4);
  assert.deepEqual(
    dealt.hand.map((c) => c.id),
    ["c0", "c1", "c2", "c3"],
  );
  for (let i = 0; i < 4; i++) {
    assert.equal(dealt.hand[i]!.value, dealt.values[i]);
    assert.ok(dealt.values[i]! >= 1 && dealt.values[i]! <= 13, "value in 1..13");
    assert.ok(dealt.suits[i]! >= 0 && dealt.suits[i]! <= 3, "suit in 0..3");
  }
});

test("target matches the variant: 24 is always 24, 20-something is 18 + 4th card", () => {
  const rng = mulberry32(99);
  for (let i = 0; i < 50; i++) {
    const c = dealSolvableHand("24", rng);
    assert.equal(c.target, 24);
    const t = dealSolvableHand("20_something", rng);
    assert.equal(t.target, 18 + t.hand[3]!.value);
    assert.equal(t.target, computeTarget("20_something", t.hand));
  }
});

test("re-rolls past an unsolvable hand instead of dealing it", () => {
  // Draw value 1 from r=0 (1 + floor(0*13)); value 6 from r=5/13 (1 + floor(5)).
  // Attempt 1 → [1,1,1,1], which cannot make 24 → must be skipped.
  // Attempt 2 → [6,6,6,6], which makes 24 (6+6+6+6) → must be returned.
  const draws = [
    0, 0, 0, 0, 0, 0, 0, 0, // attempt 1: values [1,1,1,1], suits [0,0,0,0]
    5 / 13, 5 / 13, 5 / 13, 5 / 13, 0, 0, 0, 0, // attempt 2: values [6,6,6,6]
  ];
  const dealt = dealSolvableHand("24", queuedRng(draws));
  assert.deepEqual(dealt.values, [6, 6, 6, 6]);
  assert.ok(isSolvable({ hand: dealt.hand, target: 24, operations: CLASSIC_OPERATIONS }));
});

test("is pure: same seed yields the same hand", () => {
  const a = dealSolvableHand("20_something", mulberry32(42));
  const b = dealSolvableHand("20_something", mulberry32(42));
  assert.deepEqual(a, b);
});
