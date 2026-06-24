import { test } from "node:test";
import assert from "node:assert/strict";

import { planNotifications, STREAK_RISK_LEAD_HOURS, type NotifyInputs } from "./notifications.ts";

const HOUR = 3_600_000;

const base: NotifyInputs = {
  nowMs: 0,
  nextMidnightMs: 10 * HOUR, // midnight 10h away
  nextNudgeMs: 33 * HOUR, // tomorrow morning
  nextWeeklyResetMs: 3 * 24 * HOUR,
  streak: 5,
  playedToday: false,
};

test("always schedules the daily nudge and weekly recap", () => {
  const ids = planNotifications(base).map((n) => n.id);
  assert.ok(ids.includes("daily-nudge"));
  assert.ok(ids.includes("weekly-recap"));
});

test("streak-at-risk fires when a live streak is unprotected, lead-time before midnight", () => {
  const plan = planNotifications(base);
  const risk = plan.find((n) => n.id === "streak-risk");
  assert.ok(risk, "expected a streak-risk note");
  assert.equal(risk!.fireAtMs, base.nextMidnightMs - STREAK_RISK_LEAD_HOURS * HOUR);
  assert.match(risk!.body, /5-day streak/); // personalized with the count
});

test("no streak-risk note when already played today or no streak", () => {
  assert.equal(planNotifications({ ...base, playedToday: true }).some((n) => n.id === "streak-risk"), false);
  assert.equal(planNotifications({ ...base, streak: 0 }).some((n) => n.id === "streak-risk"), false);
});

test("no streak-risk note when its fire time is already in the past", () => {
  // Less than the lead time remains before midnight → the warning slot has passed.
  const late = { ...base, nowMs: 9 * HOUR, nextMidnightMs: 10 * HOUR };
  assert.equal(planNotifications(late).some((n) => n.id === "streak-risk"), false);
});
