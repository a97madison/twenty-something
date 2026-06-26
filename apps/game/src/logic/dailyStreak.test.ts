import { test } from "node:test";
import assert from "node:assert/strict";

import {
  emptyDailyStreak,
  recordDailyPlay,
  dailyStreakStatus,
  loadDailyStreak,
  saveDailyStreak,
  MAX_FREEZES,
  type DailyStreak,
} from "./engine.ts";

/** Play a sequence of dayKeys in order, returning the final state + last event. */
function playDays(days: string[], start: DailyStreak = emptyDailyStreak()) {
  let state = start;
  let event = recordDailyPlay(state, days[0]!).event;
  for (const d of days) {
    const r = recordDailyPlay(state, d);
    state = r.state;
    event = r.event;
  }
  return { state, event };
}

test("first play starts the streak at 1", () => {
  const { state, event } = recordDailyPlay(emptyDailyStreak(), "2026-06-25");
  assert.equal(state.current, 1);
  assert.equal(state.best, 1);
  assert.equal(state.lastDate, "2026-06-25");
  assert.equal(event.kind, "first");
});

test("consecutive days extend the streak", () => {
  const { state } = playDays(["2026-06-25", "2026-06-26", "2026-06-27"]);
  assert.equal(state.current, 3);
  assert.equal(state.best, 3);
});

test("replaying the same day is a no-op", () => {
  let { state } = recordDailyPlay(emptyDailyStreak(), "2026-06-25");
  const r = recordDailyPlay(state, "2026-06-25");
  assert.equal(r.event.kind, "same_day");
  assert.deepEqual(r.state, state);
});

test("a missed day with no freeze resets the streak to 1", () => {
  let { state } = playDays(["2026-06-20", "2026-06-21", "2026-06-22"]); // current 3, no freezes
  const r = recordDailyPlay(state, "2026-06-24"); // skipped the 23rd
  assert.equal(r.event.kind, "reset");
  assert.equal(r.state.current, 1);
  assert.equal(r.state.best, 3, "best is preserved across a reset");
});

test("a freeze bridges a single missed day", () => {
  const seed: DailyStreak = { current: 4, best: 4, lastDate: "2026-06-22", freezes: 1, perfectWeeks: 0 };
  const r = recordDailyPlay(seed, "2026-06-24"); // missed the 23rd, 1 freeze covers it
  assert.equal(r.event.kind, "frozen");
  assert.equal(r.event.freezesUsed, 1);
  assert.equal(r.state.current, 5, "streak continues through the frozen day");
  assert.equal(r.state.freezes, 0, "the freeze was spent");
});

test("a gap wider than the banked freezes still resets", () => {
  const seed: DailyStreak = { current: 9, best: 9, lastDate: "2026-06-20", freezes: 1, perfectWeeks: 1 };
  const r = recordDailyPlay(seed, "2026-06-24"); // missed 21/22/23 = 3 days, only 1 freeze
  assert.equal(r.event.kind, "reset");
  assert.equal(r.state.current, 1);
  assert.equal(r.state.freezes, 1, "freezes are kept when they can't cover the gap");
});

test("a perfect week (7-day streak) earns a freeze and counts a perfect week", () => {
  const days = Array.from({ length: 7 }, (_, i) => `2026-06-${String(20 + i).padStart(2, "0")}`);
  const { state, event } = playDays(days);
  assert.equal(state.current, 7);
  assert.equal(event.perfectWeek, true);
  assert.equal(event.earnedFreeze, true);
  assert.equal(state.freezes, 1);
  assert.equal(state.perfectWeeks, 1);
});

test("freezes never exceed the cap, even on a perfect week", () => {
  const seed: DailyStreak = { current: 13, best: 13, lastDate: "2026-06-25", freezes: MAX_FREEZES, perfectWeeks: 1 };
  const r = recordDailyPlay(seed, "2026-06-26"); // current → 14 (a perfect week)
  assert.equal(r.event.perfectWeek, true);
  assert.equal(r.event.earnedFreeze, false, "already at the cap");
  assert.equal(r.state.freezes, MAX_FREEZES);
});

test("dailyStreakStatus reflects live state without mutating", () => {
  const seed: DailyStreak = { current: 5, best: 5, lastDate: "2026-06-25", freezes: 1, perfectWeeks: 0 };
  // same day → played, not at risk
  assert.deepEqual(dailyStreakStatus(seed, "2026-06-25"), { current: 5, freezes: 1, playedToday: true, alive: true, atRisk: false });
  // next day, unplayed → alive but at risk
  assert.deepEqual(dailyStreakStatus(seed, "2026-06-26"), { current: 5, freezes: 1, playedToday: false, alive: true, atRisk: true });
  // one missed day, a freeze can still bridge it today → alive, at risk
  assert.equal(dailyStreakStatus(seed, "2026-06-27").alive, true);
  // gap beyond freeze coverage → broken
  assert.deepEqual(dailyStreakStatus(seed, "2026-06-29"), { current: 0, freezes: 1, playedToday: false, alive: false, atRisk: false });
  // never played
  assert.equal(dailyStreakStatus(emptyDailyStreak(), "2026-06-25").alive, false);
});

test("persistence round-trips and sanitizes junk", async () => {
  const store = (() => {
    const m = new Map<string, string>();
    return { getItem: async (k: string) => m.get(k) ?? null, setItem: async (k: string, v: string) => void m.set(k, v) };
  })();
  const seed: DailyStreak = { current: 3, best: 8, lastDate: "2026-06-25", freezes: 2, perfectWeeks: 1 };
  await saveDailyStreak(store, seed);
  assert.deepEqual(await loadDailyStreak(store), seed);

  await store.setItem("twenty-something:daily-streak", '{"current":"x","freezes":99,"lastDate":5}');
  const cleaned = await loadDailyStreak(store);
  assert.equal(cleaned.current, 0, "junk current → 0");
  assert.equal(cleaned.freezes, MAX_FREEZES, "freezes clamped to the cap");
  assert.equal(cleaned.lastDate, null, "non-string lastDate → null");
});
