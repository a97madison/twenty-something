import { test } from "node:test";
import assert from "node:assert/strict";

import {
  loadStats,
  saveStats,
  emptyStats,
  allTimeRollup,
  loadDailyDone,
  saveDailyDone,
  isDailyDone,
  type KeyValueStore,
  type AllStats,
} from "./engine.ts";

// In-memory KeyValueStore standing in for AsyncStorage.
function memStore(): KeyValueStore & { map: Map<string, string> } {
  const map = new Map<string, string>();
  return {
    map,
    async getItem(k) {
      return map.has(k) ? map.get(k)! : null;
    },
    async setItem(k, v) {
      map.set(k, v);
    },
  };
}

// Recover the storage key the engine uses without exporting it.
async function statsKey(store: ReturnType<typeof memStore>): Promise<string> {
  await saveStats(store, emptyStats());
  const key = [...store.map.keys()][0];
  assert.ok(key, "saveStats should have written one key");
  return key;
}

function sample(): AllStats {
  const s = emptyStats();
  s["24"].days["2026-06-24"] = { count: 3, correctCount: 2, timeSumCorrect: 14000, starSum: 9.5 };
  s["24"].bestStreak = 4;
  s["24"].bestTimeMs = 3200;
  s["20_something"].days["2026-06-23"] = { count: 1, correctCount: 1, timeSumCorrect: 6000, starSum: 4 };
  s["20_something"].bestStreak = 1;
  s["20_something"].bestTimeMs = 6000;
  return s;
}

test("loading from an empty store returns fresh empty stats", async () => {
  assert.deepEqual(await loadStats(memStore()), emptyStats());
});

test("save then load round-trips the stats", async () => {
  const store = memStore();
  const stats = sample();
  await saveStats(store, stats);
  assert.deepEqual(await loadStats(store), stats);
});

test("a round-tripped sample aggregates correctly", async () => {
  const store = memStore();
  await saveStats(store, sample());
  const loaded = await loadStats(store);
  const roll = allTimeRollup(loaded["24"]);
  assert.equal(roll.count, 3);
  assert.equal(roll.correctCount, 2);
  assert.equal(roll.avgTimeMs, 7000); // 14000 / 2
});

test("corrupt JSON falls back to empty stats instead of throwing", async () => {
  const store = memStore();
  const key = await statsKey(store);
  store.map.set(key, "{not valid json");
  assert.deepEqual(await loadStats(store), emptyStats());
});

test("daily-done: unset until saved, then gates today (one attempt per day)", async () => {
  const store = memStore();
  assert.equal(await loadDailyDone(store), null);
  assert.equal(isDailyDone(null, "2026-06-24"), false);

  await saveDailyDone(store, "2026-06-24");
  const last = await loadDailyDone(store);
  assert.equal(last, "2026-06-24");
  assert.equal(isDailyDone(last, "2026-06-24"), true); // played today → locked
  assert.equal(isDailyDone(last, "2026-06-25"), false); // new day → playable again
});

test("junk values are sanitized: negatives/NaN/strings drop to defaults", async () => {
  const store = memStore();
  const key = await statsKey(store);
  store.map.set(
    key,
    JSON.stringify({
      "24": { days: { "2026-06-24": { count: -5, correctCount: "x", timeSumCorrect: NaN, starSum: 3 } }, bestStreak: -2, bestTimeMs: "fast" },
    }),
  );
  const loaded = await loadStats(store);
  assert.deepEqual(loaded["24"].days["2026-06-24"], { count: 0, correctCount: 0, timeSumCorrect: 0, starSum: 3 });
  assert.equal(loaded["24"].bestStreak, 0);
  assert.equal(loaded["24"].bestTimeMs, null);
  // a totally missing variant still comes back as empty, not undefined
  assert.deepEqual(loaded["20_something"], emptyStats()["20_something"]);
});
