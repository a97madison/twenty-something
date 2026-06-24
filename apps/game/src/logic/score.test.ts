import { test } from "node:test";
import assert from "node:assert/strict";

import { solveScore, BASE_SCORE, MIN_SCORE, PENALTY_PER_SEC } from "./engine.ts";

test("an instant solve earns the base score", () => {
  assert.equal(solveScore(0), BASE_SCORE);
});

test("negative elapsed (clock skew) is clamped to the base score", () => {
  assert.equal(solveScore(-5000), BASE_SCORE);
});

test("score decays linearly with time", () => {
  assert.equal(solveScore(30_000), BASE_SCORE - PENALTY_PER_SEC * 30); // 700
  assert.equal(solveScore(10_000), BASE_SCORE - PENALTY_PER_SEC * 10); // 900
});

test("score floors at MIN_SCORE and never goes below — slow still counts", () => {
  // BASE - PENALTY*sec hits MIN at (BASE-MIN)/PENALTY = 90s.
  assert.equal(solveScore(90_000), MIN_SCORE);
  assert.equal(solveScore(120_000), MIN_SCORE);
  assert.equal(solveScore(60 * 60 * 1000), MIN_SCORE);
});

test("score is monotonically non-increasing in elapsed time", () => {
  let prev = solveScore(0);
  for (let ms = 1000; ms <= 200_000; ms += 1000) {
    const s = solveScore(ms);
    assert.ok(s <= prev, `score rose: ${s} > ${prev} at ${ms}ms`);
    prev = s;
  }
});

test("score is always an integer within [MIN_SCORE, BASE_SCORE]", () => {
  for (const ms of [0, 250, 999, 12_345, 89_999, 90_001, 500_000]) {
    const s = solveScore(ms);
    assert.ok(Number.isInteger(s), `not an integer: ${s}`);
    assert.ok(s >= MIN_SCORE && s <= BASE_SCORE, `out of range: ${s}`);
  }
});
