import { test } from "node:test";
import assert from "node:assert/strict";

import {
  buildShareText,
  buildVariantShare,
  formatExpr,
  formatTime,
  VARIANT_NAME,
  type Expr,
  type Hand,
  type ShareableResult,
  type ShareOutcome,
} from "./index.ts";

// A real solution kept around only to prove it can never leak into the share.
const solution: Expr = {
  kind: "node",
  op: "÷",
  left: { kind: "leaf", cardId: "a", value: 8 },
  right: {
    kind: "node",
    op: "-",
    left: { kind: "leaf", cardId: "b", value: 3 },
    right: {
      kind: "node",
      op: "÷",
      left: { kind: "leaf", cardId: "c", value: 8 },
      right: { kind: "leaf", cardId: "d", value: 3 },
    },
  },
};

const base: ShareableResult = {
  gameName: "20-Something",
  date: "2026-06-24",
  target: 24,
  solved: true,
  solveTimeSec: 41,
  attempts: 2,
  currentStreak: 12,
  rarity: "top 8%",
  url: "https://example.com/d/2026-06-24",
};

// ---- the core guarantee: outcome only, no method whatsoever ----------------

test("CRITICAL: share reveals no method — no solution, structure, or operations", () => {
  const text = buildShareText(base);
  assert.ok(!text.includes(formatExpr(solution)), "leaked literal solution");
  assert.doesNotMatch(text, /[()]/, "leaked structure via parentheses");
  assert.doesNotMatch(text, /🟦/, "leaked positional pattern");
  assert.doesNotMatch(text, /[➕➖✖️➗]/, "leaked operations");
});

test("solve time is the headline brag", () => {
  const text = buildShareText(base);
  const firstSolvedLine = text.split("\n")[2]!; // after gameName and Target
  assert.match(firstSolvedLine, /Solved in 0:41/);
});

test("share carries outcome stats only", () => {
  const text = buildShareText(base);
  assert.match(text, /20-Something · 2026-06-24/);
  assert.match(text, /Target 24/);
  assert.match(text, /⚡ Solved in 0:41/);
  assert.match(text, /🎯 2 tries/);
  assert.match(text, /🏅 top 8%/);
  assert.match(text, /🔥 12 day streak/);
  assert.match(text, /example\.com/);
});

test("solved without a time still reads as solved", () => {
  const text = buildShareText({ ...base, solveTimeSec: undefined });
  assert.match(text, /✅ Solved/);
  assert.doesNotMatch(text, /Solved in/);
});

test("single attempt reads 'try' not 'tries'", () => {
  const text = buildShareText({ ...base, attempts: 1 });
  assert.match(text, /1 try\b/);
  assert.doesNotMatch(text, /1 tries/);
});

test("unsolved share is clean with no fake flex", () => {
  const text = buildShareText({ ...base, solved: false });
  assert.match(text, /Didn't crack it/);
  assert.doesNotMatch(text, /⚡/);
  assert.doesNotMatch(text, /Solved in/);
  assert.match(text, /🔥 12 day streak/);
});

test("streak omitted when zero", () => {
  assert.doesNotMatch(buildShareText({ ...base, currentStreak: 0 }), /day streak/);
});

test("time formats minutes correctly", () => {
  assert.equal(formatTime(41), "0:41");
  assert.equal(formatTime(125), "2:05");
  assert.equal(formatTime(600), "10:00");
});

// ---- per-variant share builders -------------------------------------------

function hand(a: number, b: number, c: number, d: number): Hand {
  return [
    { id: "c0", value: a },
    { id: "c1", value: b },
    { id: "c2", value: c },
    { id: "c3", value: d },
  ];
}

const outcome: ShareOutcome = {
  date: "2026-06-24",
  solved: true,
  solveTimeSec: 41,
  currentStreak: 5,
};

test("24 variant share is labeled '24' and targets 24", () => {
  const r = buildVariantShare("24", hand(4, 6, 3, 2), outcome);
  assert.equal(r.gameName, "24");
  assert.equal(r.target, 24);
  assert.match(buildShareText(r), /^24 · 2026-06-24/);
  assert.match(buildShareText(r), /Target 24/);
});

test("24 target stays 24 regardless of the hand", () => {
  const r = buildVariantShare("24", hand(13, 13, 13, 13), outcome);
  assert.equal(r.target, 24);
});

test("20-Something share is labeled and targets 18 + the 4th card", () => {
  const r = buildVariantShare("20_something", hand(7, 4, 2, 3), outcome);
  assert.equal(r.gameName, "20-Something");
  assert.equal(r.target, 21); // 18 + 3
  assert.match(buildShareText(r), /^20-Something · 2026-06-24/);
  assert.match(buildShareText(r), /Target 21/);
});

test("20-Something target follows the 4th card (Jack = 11 → 29)", () => {
  const r = buildVariantShare("20_something", hand(7, 4, 2, 11), outcome);
  assert.equal(r.target, 29);
  assert.match(buildShareText(r), /Target 29/);
});

test("variant share inherits outcome-only safety (no method leak)", () => {
  const r = buildVariantShare("20_something", hand(7, 4, 2, 3), outcome);
  const text = buildShareText(r);
  assert.doesNotMatch(text, /[()]/);
  assert.doesNotMatch(text, /[➕➖✖️➗]/);
});

test("VARIANT_NAME covers both variants", () => {
  assert.equal(VARIANT_NAME["24"], "24");
  assert.equal(VARIANT_NAME["20_something"], "20-Something");
});
