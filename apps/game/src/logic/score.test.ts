import { test } from "node:test";
import assert from "node:assert/strict";

import {
  starScore,
  FAST_MS,
  SLOW_MS,
  CORRECT_BASE_STARS,
  MAX_STARS,
} from "./engine.ts";

test("an instant correct solve earns the max stars", () => {
  assert.equal(starScore(0), MAX_STARS);
  assert.equal(starScore(FAST_MS), MAX_STARS);
});

test("a slow correct solve still earns the correct-base stars (never zero)", () => {
  assert.equal(starScore(SLOW_MS), CORRECT_BASE_STARS);
  assert.equal(starScore(SLOW_MS * 10), CORRECT_BASE_STARS);
});

test("the speed bonus decays linearly between FAST_MS and SLOW_MS", () => {
  const mid = (FAST_MS + SLOW_MS) / 2;
  const expected = (MAX_STARS + CORRECT_BASE_STARS) / 2;
  assert.ok(Math.abs(starScore(mid) - expected) < 1e-9);
});

test("negative elapsed (clock skew) is clamped to the max", () => {
  assert.equal(starScore(-5000), MAX_STARS);
});

test("star score stays within [CORRECT_BASE_STARS, MAX_STARS] and is non-increasing", () => {
  let prev = Infinity;
  for (let t = 0; t <= SLOW_MS + 5000; t += 1000) {
    const s = starScore(t);
    assert.ok(s >= CORRECT_BASE_STARS - 1e-9 && s <= MAX_STARS + 1e-9, `out of range at t=${t}: ${s}`);
    assert.ok(s <= prev + 1e-9, `star score rose at t=${t}`);
    prev = s;
  }
});
