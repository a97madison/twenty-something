import { test } from "node:test";
import assert from "node:assert/strict";

import {
  findFirstSolution,
  computeTarget,
  isSolvable,
  CLASSIC_OPERATIONS,
  type Expr,
  type Hand,
  type Variant,
} from "@twenty-something/core";

import {
  newGame,
  submitSolution,
  claimNoSolution,
  giveUp,
  currentHand,
  handsTotal,
  allTimeRollup,
  weeklyRollup,
  msUntilWeeklyReset,
  daysAndHours,
  emptyStats,
  starScore,
  type DealtHand,
} from "./engine.ts";

const DAY = "2026-06-24";

/** Build a DealtHand from raw values; target + solvable come from core (honest). */
function mkHand(values: number[], variant: Variant): DealtHand {
  const hand: Hand = [
    { id: "c0", value: values[0]! },
    { id: "c1", value: values[1]! },
    { id: "c2", value: values[2]! },
    { id: "c3", value: values[3]! },
  ];
  const target = computeTarget(variant, hand);
  return {
    values,
    suits: [0, 1, 2, 3],
    hand,
    target,
    solvable: isSolvable({ hand, target, operations: CLASSIC_OPERATIONS }),
  };
}

const SOLVABLE = () => mkHand([6, 6, 6, 6], "24"); // 6+6+6+6 = 24
const UNSOLVABLE = () => mkHand([1, 1, 1, 1], "24"); // cannot reach 24

function solveExpr(hand: DealtHand): Expr {
  const sol = findFirstSolution({ hand: hand.hand, target: hand.target, operations: CLASSIC_OPERATIONS });
  assert.ok(sol, "hand must be solvable");
  return sol.expr;
}

// ((6+6) + (6-6)) = 12 ≠ 24 — uses all four cards, so it's wrong_value, not wrong_cards.
const WRONG_EXPR: Expr = {
  kind: "node",
  op: "+",
  left: { kind: "node", op: "+", left: { kind: "leaf", cardId: "c0", value: 6 }, right: { kind: "leaf", cardId: "c1", value: 6 } },
  right: { kind: "node", op: "-", left: { kind: "leaf", cardId: "c2", value: 6 }, right: { kind: "leaf", cardId: "c3", value: 6 } },
};

test("newGame starts at streak 0, empty session tally, given clock, first hand", () => {
  const g = newGame("24", [SOLVABLE(), UNSOLVABLE()], { now: 1000 });
  assert.equal(g.streak, 0);
  assert.equal(g.handStartedAt, 1000);
  assert.deepEqual(g.session, { total: 0, correct: 0, timeSumCorrect: 0, starSum: 0 });
  assert.equal(g.done, false);
  assert.equal(handsTotal(g), 2);
  assert.equal(currentHand(g)!.values.join(""), "6666");
});

test("a correct solution scores by speed, bumps streak, records stats, advances", () => {
  const g = newGame("24", [SOLVABLE(), SOLVABLE()], { now: 1000 });
  const out = submitSolution(g, solveExpr(SOLVABLE()), 1000 + 8000, DAY); // 8s
  assert.equal(out.solved, true);
  if (!out.solved) return;
  assert.equal(out.elapsedMs, 8000);
  assert.equal(out.stars, starScore(8000));
  assert.equal(out.state.streak, 1);
  assert.equal(out.state.session.total, 1);
  assert.equal(out.state.session.correct, 1);
  assert.equal(out.state.index, 1);
  assert.equal(out.state.handStartedAt, 1000 + 8000);
  const roll = allTimeRollup(out.state.stats["24"]);
  assert.equal(roll.count, 1);
  assert.equal(roll.correctCount, 1);
  assert.equal(roll.accuracy, 1);
  assert.equal(roll.avgTimeMs, 8000);
  assert.equal(out.state.stats["24"].bestTimeMs, 8000);
});

test("a wrong solution changes nothing — wrong costs time, not the streak", () => {
  const start = newGame("24", [SOLVABLE(), SOLVABLE()], { now: 0 });
  const first = submitSolution(start, solveExpr(SOLVABLE()), 5000, DAY);
  assert.ok(first.solved);
  if (!first.solved) return;
  const g = first.state;

  const out = submitSolution(g, WRONG_EXPR, 9000, DAY);
  assert.equal(out.solved, false);
  if (out.solved) return;
  assert.equal(out.error, "wrong_value");
  assert.equal(out.state, g); // identical reference — untouched
  assert.equal(out.state.streak, 1);
});

test("claim 'no solution' on an unsolvable hand is correct (streak +1, no reveal)", () => {
  const g = newGame("24", [UNSOLVABLE()], { now: 0 });
  const out = claimNoSolution(g, 4000, DAY);
  assert.equal(out.correct, true);
  assert.equal(out.reveal, null);
  assert.equal(out.state.streak, 1);
  assert.equal(out.state.session.correct, 1);
  assert.equal(out.state.done, true);
});

test("claim 'no solution' on a solvable hand is wrong: reveal a solution, break streak", () => {
  const g = newGame("24", [SOLVABLE()], { now: 0 });
  const out = claimNoSolution(g, 4000, DAY);
  assert.equal(out.correct, false);
  assert.ok(out.reveal && typeof out.reveal.solution === "string", "should reveal a worked solution");
  assert.equal(out.state.streak, 0);
  const roll = allTimeRollup(out.state.stats["24"]);
  assert.equal(roll.count, 1);
  assert.equal(roll.correctCount, 0);
});

test("pass (give up) counts incorrect and reveals (solution string, or null when none existed)", () => {
  const solvable = newGame("24", [SOLVABLE()], { now: 0 });
  const a = giveUp(solvable, 3000, DAY);
  assert.equal(a.correct, false);
  assert.ok(a.reveal && typeof a.reveal.solution === "string");
  assert.equal(a.state.streak, 0);
  assert.equal(a.state.session.total, 1);
  assert.equal(a.state.session.correct, 0);

  const unsolvable = newGame("24", [UNSOLVABLE()], { now: 0 });
  const b = giveUp(unsolvable, 3000, DAY);
  assert.ok(b.reveal && b.reveal.solution === null, "no solution existed");
});

test("a bounded session ends after every hand is decided", () => {
  let g = newGame("24", [SOLVABLE(), UNSOLVABLE()], { now: 0 });
  const a = submitSolution(g, solveExpr(SOLVABLE()), 2000, DAY);
  assert.ok(a.solved);
  if (!a.solved) return;
  g = a.state;
  assert.equal(g.done, false);
  const b = claimNoSolution(g, 4000, DAY); // hand 2 is unsolvable → correct
  assert.equal(b.state.done, true);
  assert.equal(currentHand(b.state), undefined);
  assert.equal(b.state.session.total, 2);
  assert.equal(b.state.session.correct, 2);
});

test("weekly rollup counts only the current Monday→Sunday week", () => {
  const g = newGame("24", [SOLVABLE()], { now: 0, stats: emptyStats() });
  const out = submitSolution(g, solveExpr(SOLVABLE()), 5000, "2026-06-24"); // a Wednesday
  assert.ok(out.solved);
  if (!out.solved) return;
  const vs = out.state.stats["24"];
  // Hand sits in the week Mon 2026-06-22 … Sun 2026-06-28; the window is
  // [this week's Monday, the query day].
  assert.equal(weeklyRollup(vs, "2026-06-24").count, 1); // same day
  assert.equal(weeklyRollup(vs, "2026-06-28").count, 1); // Sunday (week end) → still counts
  assert.equal(weeklyRollup(vs, "2026-06-29").count, 0); // next Monday → week reset, drops out
});

test("weekly reset counts down to the next Monday 00:00 UTC, worldwide", () => {
  const DAY_MS = 86_400_000, HOUR_MS = 3_600_000;
  const monday = Date.UTC(2026, 5, 22, 0, 0, 0); // 2026-06-22 is a Monday
  assert.equal(msUntilWeeklyReset(monday), 7 * DAY_MS); // just reset → a full week left
  assert.equal(msUntilWeeklyReset(monday + HOUR_MS), 7 * DAY_MS - HOUR_MS);
  const sundayLate = Date.UTC(2026, 5, 28, 23, 0, 0); // Sunday 23:00 UTC
  assert.equal(msUntilWeeklyReset(sundayLate), HOUR_MS); // 1h until Monday
});

test("daysAndHours splits a duration and floors negatives to zero", () => {
  assert.deepEqual(daysAndHours(2 * 86_400_000 + 5 * 3_600_000 + 999), { days: 2, hours: 5 });
  assert.deepEqual(daysAndHours(0), { days: 0, hours: 0 });
  assert.deepEqual(daysAndHours(-1000), { days: 0, hours: 0 });
});
