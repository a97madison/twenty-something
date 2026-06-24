import { test } from "node:test";
import assert from "node:assert/strict";

import {
  isDateKey,
  dailyFieldKey,
  validateRating,
  computePercentile,
  MAX_RATING,
} from "./percentile.ts";

// ---- input validation ----------------------------------------------------

test("isDateKey accepts YYYY-MM-DD and rejects everything else", () => {
  assert.equal(isDateKey("2026-06-24"), true);
  assert.equal(isDateKey("2026-6-24"), false); // unpadded
  assert.equal(isDateKey("06-24-2026"), false);
  assert.equal(isDateKey(""), false);
  assert.equal(isDateKey(20260624), false);
  assert.equal(isDateKey(undefined), false);
});

test("dailyFieldKey joins date + variant into a slash-free id", () => {
  assert.equal(dailyFieldKey("2026-06-24", "24"), "2026-06-24__24");
  assert.equal(dailyFieldKey("2026-06-24", "20_something"), "2026-06-24__20_something");
});

test("validateRating accepts finite ratings in [0, MAX_RATING]", () => {
  assert.deepEqual(validateRating(0), { ok: true, rating: 0 });
  assert.deepEqual(validateRating(3.29), { ok: true, rating: 3.29 });
  assert.deepEqual(validateRating(MAX_RATING), { ok: true, rating: MAX_RATING });
});

test("validateRating rejects out-of-range and non-numbers with a reason", () => {
  assert.deepEqual(validateRating(-0.1), { ok: false, reason: "rating_out_of_range" });
  assert.deepEqual(validateRating(MAX_RATING + 0.1), { ok: false, reason: "rating_out_of_range" });
  assert.deepEqual(validateRating(Infinity), { ok: false, reason: "rating_not_a_number" });
  assert.deepEqual(validateRating(NaN), { ok: false, reason: "rating_not_a_number" });
  assert.deepEqual(validateRating("4.5"), { ok: false, reason: "rating_not_a_number" });
  assert.deepEqual(validateRating(undefined), { ok: false, reason: "rating_not_a_number" });
});

// ---- percentile ----------------------------------------------------------

test("a lone player is trivially average (50)", () => {
  assert.equal(computePercentile([3.2], 3.2), 50);
});

test("the empty field falls back to 50 defensively", () => {
  assert.equal(computePercentile([], 4), 50);
});

test("top and bottom of a tie-free field are symmetric", () => {
  const field = [1, 2, 3, 4];
  assert.equal(computePercentile(field, 4), 88); // (3 + 0.5)/4 = 0.875 → 88
  assert.equal(computePercentile(field, 1), 13); // (0 + 0.5)/4 = 0.125 → 13
});

test("a middling score lands near 50", () => {
  // field of 5; my=3 has 2 below, 1 equal (self), → (2 + 0.5)/5 = 0.5
  assert.equal(computePercentile([1, 2, 3, 4, 5], 3), 50);
});

test("ties split evenly (half-tie rule)", () => {
  // everyone identical → everyone is exactly average
  assert.equal(computePercentile([4, 4, 4, 4], 4), 50);
  // my=4 with one peer at 4 and two below → (2 + 0.5×2)/4 = 0.75
  assert.equal(computePercentile([2, 3, 4, 4], 4), 75);
});

test("percentile ignores field ordering", () => {
  const a = computePercentile([5, 1, 3, 2, 4], 4);
  const b = computePercentile([1, 2, 3, 4, 5], 4);
  assert.equal(a, b);
});

test("percentile is monotonic in the player's own rating", () => {
  const field = [1, 2, 3, 4, 5];
  let prev = -1;
  for (const r of [1, 2, 3, 4, 5]) {
    const p = computePercentile(field, r);
    assert.ok(p >= prev, `expected non-decreasing percentile, got ${p} after ${prev}`);
    prev = p;
  }
});

test("percentile is always an integer in [0, 100]", () => {
  const field = [0, 1.5, 2.5, 3.33, 4.9, 5];
  for (const r of field) {
    const p = computePercentile(field, r);
    assert.ok(Number.isInteger(p), `expected integer, got ${p}`);
    assert.ok(p >= 0 && p <= 100, `expected 0..100, got ${p}`);
  }
});
