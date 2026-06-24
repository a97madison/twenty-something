import { test } from "node:test";
import assert from "node:assert/strict";

import { isSolvable, computeTarget, CLASSIC_OPERATIONS } from "@twenty-something/core";
import { dealHand, dealHands, dealDailyHands, epochDayFromKey } from "./engine.ts";

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

test("the solvable flag always matches core's solver (both variants)", () => {
  const rng = mulberry32(12345);
  for (let i = 0; i < 200; i++) {
    for (const variant of ["24", "20_something"] as const) {
      const dealt = dealHand(variant, rng);
      const truth = isSolvable({ hand: dealt.hand, target: dealt.target, operations: CLASSIC_OPERATIONS });
      assert.equal(dealt.solvable, truth, `solvable flag wrong for ${variant} ${dealt.values}`);
    }
  }
});

test("natural distribution deals SOME unsolvable hands (no re-rolling)", () => {
  const rng = mulberry32(999);
  const hands = dealHands("24", 300, rng);
  const unsolvable = hands.filter((h) => !h.solvable).length;
  assert.ok(unsolvable > 0, "expected at least one unsolvable hand at natural distribution");
});

test("hand has ids c0..c3 and values/suits in range", () => {
  const dealt = dealHand("24", mulberry32(7));
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
    const c = dealHand("24", rng);
    assert.equal(c.target, 24);
    const t = dealHand("20_something", rng);
    assert.equal(t.target, 18 + t.hand[3]!.value);
    assert.equal(t.target, computeTarget("20_something", t.hand));
  }
});

test("dealHands returns exactly n hands", () => {
  assert.equal(dealHands("24", 5, mulberry32(1)).length, 5);
  assert.equal(dealHands("20_something", 0, mulberry32(1)).length, 0);
});

test("daily deal is deterministic: same date+variant ⇒ identical hands", () => {
  const a = dealDailyHands("24", "2026-06-24", 5);
  const b = dealDailyHands("24", "2026-06-24", 5);
  assert.deepEqual(a, b);
  assert.equal(a.length, 5);
});

test("daily deal differs across dates and across variants", () => {
  const d1 = dealDailyHands("24", "2026-06-24", 5);
  const d2 = dealDailyHands("24", "2026-06-25", 5);
  const v = dealDailyHands("20_something", "2026-06-24", 5);
  assert.notDeepEqual(d1.map((h) => h.values), d2.map((h) => h.values));
  assert.notDeepEqual(
    d1.map((h) => h.values),
    v.map((h) => h.values),
  );
});

test("epochDayFromKey: consecutive days differ by 1, across a month boundary", () => {
  assert.equal(epochDayFromKey("2026-07-01") - epochDayFromKey("2026-06-30"), 1);
  assert.equal(epochDayFromKey("2026-01-01") - epochDayFromKey("2025-12-31"), 1);
  assert.equal(epochDayFromKey("1970-01-01"), 0);
});
