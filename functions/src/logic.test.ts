import { test } from "node:test";
import assert from "node:assert/strict";

import { verifySubmission, type StoredPuzzle } from "./verify.ts";
import { applySolve, dayDelta, deriveSolveTimeSec, sanitizeAttempts, type StreakState } from "./streak.ts";
import type { Expr } from "@twenty-something/core";

// ---- verifier ------------------------------------------------------------

const stored: StoredPuzzle = {
  cards: [
    { id: "c0", value: 4 },
    { id: "c1", value: 6 },
    { id: "c2", value: 3 },
    { id: "c3", value: 2 },
  ],
  target: 24,
  operations: ["+", "-", "×", "÷"],
};

// 4 × 6 × (3 - 2) = 24
const goodExpr: Expr = {
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

test("verifySubmission accepts a correct solution", () => {
  const r = verifySubmission(stored, goodExpr);
  assert.equal(r.ok, true);
});

test("verifySubmission rejects forged values even with right ids", () => {
  const forged: Expr = structuredClone(goodExpr) as Expr;
  // forge c0 from 4 to 24
  (forged as any).left.left.value = 24;
  const r = verifySubmission(stored, forged);
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.reason, "forged_value");
});

test("verifySubmission rejects malformed client input without throwing", () => {
  const r = verifySubmission(stored, { kind: "node", op: "+" });
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.reason, "malformed_expr");
});

test("verifySubmission guards corrupt server puzzle docs", () => {
  const corrupt: StoredPuzzle = { ...stored, cards: stored.cards.slice(0, 3) };
  const r = verifySubmission(corrupt, goodExpr);
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.reason, "corrupt_puzzle");
});

// ---- streak --------------------------------------------------------------

test("dayDelta counts UTC days correctly", () => {
  assert.equal(dayDelta("2026-06-23", "2026-06-24"), 1);
  assert.equal(dayDelta("2026-06-24", "2026-06-24"), 0);
  assert.equal(dayDelta("2026-06-20", "2026-06-24"), 4);
  assert.equal(dayDelta("2026-02-28", "2026-03-01"), 1); // 2026 not a leap year
});

test("consecutive days extend the streak", () => {
  const prev: StreakState = { currentStreak: 5, maxStreak: 9, lastPlayedDate: "2026-06-23" };
  const { next, counted } = applySolve(prev, "2026-06-24");
  assert.equal(counted, true);
  assert.equal(next.currentStreak, 6);
  assert.equal(next.maxStreak, 9);
});

test("a gap resets the streak to 1", () => {
  const prev: StreakState = { currentStreak: 12, maxStreak: 30, lastPlayedDate: "2026-06-20" };
  const { next } = applySolve(prev, "2026-06-24");
  assert.equal(next.currentStreak, 1);
  assert.equal(next.maxStreak, 30); // max preserved
});

test("re-solving the same day is idempotent", () => {
  const prev: StreakState = { currentStreak: 6, maxStreak: 9, lastPlayedDate: "2026-06-24" };
  const { next, counted } = applySolve(prev, "2026-06-24");
  assert.equal(counted, false);
  assert.deepEqual(next, prev);
});

test("first ever solve starts a streak at 1", () => {
  const prev: StreakState = { currentStreak: 0, maxStreak: 0, lastPlayedDate: null };
  const { next, counted } = applySolve(prev, "2026-06-24");
  assert.equal(counted, true);
  assert.equal(next.currentStreak, 1);
  assert.equal(next.maxStreak, 1);
});

test("new max streak is captured", () => {
  const prev: StreakState = { currentStreak: 9, maxStreak: 9, lastPlayedDate: "2026-06-23" };
  const { next } = applySolve(prev, "2026-06-24");
  assert.equal(next.currentStreak, 10);
  assert.equal(next.maxStreak, 10);
});

// ---- server-derived metrics ----------------------------------------------

test("deriveSolveTimeSec measures elapsed time, ignoring the client", () => {
  const start = 1_000_000_000_000;
  assert.equal(deriveSolveTimeSec(start, start + 41_000), 41);
  assert.equal(deriveSolveTimeSec(start, start + 500), 1); // rounds
});

test("deriveSolveTimeSec clamps negative skew to zero", () => {
  const start = 1_000_000_000_000;
  assert.equal(deriveSolveTimeSec(start, start - 5_000), 0);
});

test("sanitizeAttempts floors to >= 1 and rejects junk", () => {
  assert.equal(sanitizeAttempts(3), 3);
  assert.equal(sanitizeAttempts(2.9), 2);
  assert.equal(sanitizeAttempts(0), 1);
  assert.equal(sanitizeAttempts(-7), 1);
  assert.equal(sanitizeAttempts("lots"), 1);
  assert.equal(sanitizeAttempts(undefined), 1);
  assert.equal(sanitizeAttempts(Infinity), 1);
});
