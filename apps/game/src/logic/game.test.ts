import { test } from "node:test";
import assert from "node:assert/strict";

import {
  findFirstSolution,
  isSolvable,
  CLASSIC_OPERATIONS,
  type Expr,
} from "@twenty-something/core";

import {
  newGame,
  submitSolution,
  passHand,
  solveScore,
  EMPTY_RECORDS,
  type GameState,
} from "./engine.ts";

// A genuine solving expression for the current hand, via core's solver.
function solveExpr(state: GameState): Expr {
  const sol = findFirstSolution({
    hand: state.current.hand,
    target: state.current.target,
    operations: CLASSIC_OPERATIONS,
  });
  assert.ok(sol, "current hand must be solvable (engine guarantees this)");
  return sol.expr;
}

// A structurally valid but wrong attempt: a single card, so it can't use all four.
function wrongExpr(state: GameState): Expr {
  return { kind: "leaf", cardId: "c0", value: state.current.values[0]! };
}

test("newGame starts at streak 0, score 0, with a solvable hand and the given clock", () => {
  const g = newGame("24", { now: 1000 });
  assert.equal(g.streak, 0);
  assert.equal(g.score, 0);
  assert.equal(g.handStartedAt, 1000);
  assert.deepEqual(g.records, EMPTY_RECORDS);
  assert.ok(isSolvable({ hand: g.current.hand, target: g.current.target, operations: CLASSIC_OPERATIONS }));
});

test("newGame seeds records from the ones passed in (loaded from storage)", () => {
  const g = newGame("24", { now: 0, records: { bestStreak: 5, bestTimeMs: 4200 } });
  assert.deepEqual(g.records, { bestStreak: 5, bestTimeMs: 4200 });
});

test("a correct solution scores by speed, bumps the streak, records bests, and deals on", () => {
  const g = newGame("24", { now: 1000 });
  const out = submitSolution(g, solveExpr(g), 1000 + 8000); // 8s solve
  assert.equal(out.solved, true);
  if (!out.solved) return;
  assert.equal(out.elapsedMs, 8000);
  assert.equal(out.gained, solveScore(8000));
  assert.equal(out.state.streak, 1);
  assert.equal(out.state.score, out.gained);
  assert.equal(out.state.records.bestStreak, 1);
  assert.equal(out.state.records.bestTimeMs, 8000);
  // dealt the next hand, clock reset to the solve time, still solvable
  assert.equal(out.state.handStartedAt, 1000 + 8000);
  assert.notEqual(out.state.current, g.current);
  assert.ok(isSolvable({ hand: out.state.current.hand, target: out.state.current.target, operations: CLASSIC_OPERATIONS }));
});

test("a wrong solution changes nothing — wrong costs time, not the streak", () => {
  let g = newGame("24", { now: 0 });
  // build a streak first so we can prove it survives a wrong answer
  const first = submitSolution(g, solveExpr(g), 5000);
  assert.equal(first.solved, true);
  if (!first.solved) return;
  g = first.state;

  const out = submitSolution(g, wrongExpr(g), 9000);
  assert.equal(out.solved, false);
  if (out.solved) return;
  assert.equal(out.error, "wrong_cards");
  assert.equal(out.state, g); // identical reference — untouched
  assert.equal(out.state.streak, 1);
});

test("streak accumulates and bestTimeMs keeps the fastest solve", () => {
  let g = newGame("24", { now: 0 });
  const a = submitSolution(g, solveExpr(g), 12_000); // 12s
  assert.ok(a.solved);
  if (!a.solved) return;
  g = a.state;
  const b = submitSolution(g, solveExpr(g), 12_000 + 3000); // 3s — faster
  assert.ok(b.solved);
  if (!b.solved) return;

  assert.equal(b.state.streak, 2);
  assert.equal(b.state.records.bestStreak, 2);
  assert.equal(b.state.records.bestTimeMs, 3000); // min(12000, 3000)
  assert.equal(b.state.score, a.gained + b.gained);
});

test("passing forfeits the streak but preserves score and records, and deals on", () => {
  let g = newGame("24", { now: 0 });
  const solved = submitSolution(g, solveExpr(g), 4000);
  assert.ok(solved.solved);
  if (!solved.solved) return;
  g = solved.state;
  assert.equal(g.streak, 1);

  const passed = passHand(g, 10_000);
  assert.equal(passed.streak, 0); // streak broken
  assert.equal(passed.score, g.score); // total unchanged
  assert.deepEqual(passed.records, g.records); // bests preserved (bestStreak stays 1)
  assert.equal(passed.records.bestStreak, 1);
  assert.equal(passed.handStartedAt, 10_000);
  assert.notEqual(passed.current, g.current);
});
