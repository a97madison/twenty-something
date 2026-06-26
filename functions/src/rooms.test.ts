import { test } from "node:test";
import assert from "node:assert/strict";

import { isSolvable, CLASSIC_OPERATIONS, type Hand } from "@twenty-something/core";
import { dealSolvableRound, makeRoomCode, sanitizeWinningScore, sanitizeDuration } from "./rooms.ts";

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

test("dealSolvableRound always returns a genuinely solvable hand (both variants)", () => {
  const rng = mulberry32(42);
  for (let i = 0; i < 300; i++) {
    for (const variant of ["24", "20_something"] as const) {
      const round = dealSolvableRound(variant, rng);
      const hand = round.cards as unknown as Hand;
      assert.equal(round.cards.length, 4);
      assert.deepEqual(round.cards.map((c) => c.id), ["c0", "c1", "c2", "c3"]);
      assert.ok(isSolvable({ hand, target: round.target, operations: CLASSIC_OPERATIONS }), `unsolvable round dealt for ${variant}`);
    }
  }
});

test("dealSolvableRound is deterministic for a given rng", () => {
  assert.deepEqual(dealSolvableRound("24", mulberry32(7)), dealSolvableRound("24", mulberry32(7)));
});

test("makeRoomCode: right length, unambiguous charset", () => {
  const code = makeRoomCode(mulberry32(1), 4);
  assert.equal(code.length, 4);
  assert.match(code, /^[BCDFGHJKLMNPQRSTVWXYZ23456789]+$/);
  // No vowels or look-alike 0/1/O/I.
  assert.doesNotMatch(code, /[AEIOU01]/);
});

test("sanitizeWinningScore clamps to 1..20, defaults 3", () => {
  assert.equal(sanitizeWinningScore(5), 5);
  assert.equal(sanitizeWinningScore(0), 1);
  assert.equal(sanitizeWinningScore(999), 20);
  assert.equal(sanitizeWinningScore("x"), 3);
});

test("sanitizeDuration clamps to 0..600, defaults 0", () => {
  assert.equal(sanitizeDuration(60), 60);
  assert.equal(sanitizeDuration(-5), 0);
  assert.equal(sanitizeDuration(99999), 600);
  assert.equal(sanitizeDuration(undefined), 0);
});
