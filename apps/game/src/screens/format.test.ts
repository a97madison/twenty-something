import { test } from "node:test";
import assert from "node:assert/strict";
import type { Expr } from "@twenty-something/core";
import type { CheckerToken } from "@twenty-something/ui";

import {
  variantLabel,
  pip,
  formatClock,
  formatSolve,
  localDayKey,
  tokenStr,
  wrongFeedbackText,
  formatRating,
  formatAccuracy,
} from "./format.ts";

test("variantLabel", () => {
  assert.equal(variantLabel("24"), "24");
  assert.equal(variantLabel("20_something"), "20-Something");
});

test("pip maps face cards", () => {
  assert.equal(pip(1), "A");
  assert.equal(pip(7), "7");
  assert.equal(pip(11), "J");
  assert.equal(pip(13), "K");
});

test("formatClock is mm:ss", () => {
  assert.equal(formatClock(0), "0:00");
  assert.equal(formatClock(9_000), "0:09");
  assert.equal(formatClock(75_000), "1:15");
});

test("formatSolve switches at a minute", () => {
  assert.equal(formatSolve(8_200), "8.2s");
  assert.equal(formatSolve(59_999), "60.0s");
  assert.equal(formatSolve(60_000), "1:00");
});

test("localDayKey zero-pads from an injected date", () => {
  assert.equal(localDayKey(new Date(2026, 0, 3)), "2026-01-03");
  assert.equal(localDayKey(new Date(2026, 11, 25)), "2026-12-25");
});

test("tokenStr renders a tapped sequence", () => {
  const tokens: CheckerToken[] = [
    { type: "lp" },
    { type: "card", i: 0 },
    { type: "op", op: "+" },
    { type: "card", i: 1 },
    { type: "rp" },
  ];
  assert.equal(tokenStr(tokens, [7, 5, 2, 3]), "(7 + 5)");
});

test("wrongFeedbackText reports the wrong value", () => {
  const expr: Expr = {
    kind: "node",
    op: "+",
    left: { kind: "leaf", cardId: "c0", value: 7 },
    right: { kind: "leaf", cardId: "c1", value: 5 },
  };
  assert.match(wrongFeedbackText("wrong_value", expr, 24), /makes 12, not 24/);
  assert.match(wrongFeedbackText("wrong_cards", expr, 24), /each of the four cards/);
});

test("formatRating / formatAccuracy handle null", () => {
  assert.equal(formatRating(null), "—");
  assert.equal(formatRating(3.295), "3.29");
  assert.equal(formatAccuracy(null), "—");
  assert.equal(formatAccuracy(0.5), "50%");
});
