import { test } from "node:test";
import assert from "node:assert/strict";

import { loadRecords, saveRecords, EMPTY_RECORDS, type KeyValueStore, type Records } from "./engine.ts";

// In-memory KeyValueStore standing in for AsyncStorage / expo-secure-store.
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

// Recover the storage key the engine uses (it's an internal constant) so tests
// can inject raw/corrupt payloads without the engine exporting it.
async function recordsKey(store: ReturnType<typeof memStore>): Promise<string> {
  await saveRecords(store, EMPTY_RECORDS);
  const key = [...store.map.keys()][0];
  assert.ok(key, "saveRecords should have written one key");
  return key;
}

test("loading from an empty store returns fresh empty records", async () => {
  assert.deepEqual(await loadRecords(memStore()), EMPTY_RECORDS);
});

test("save then load round-trips the records", async () => {
  const store = memStore();
  const records: Records = { bestStreak: 7, bestTimeMs: 3421 };
  await saveRecords(store, records);
  assert.deepEqual(await loadRecords(store), records);
});

test("a null bestTimeMs (no solve yet) survives a round-trip", async () => {
  const store = memStore();
  await saveRecords(store, { bestStreak: 2, bestTimeMs: null });
  assert.deepEqual(await loadRecords(store), { bestStreak: 2, bestTimeMs: null });
});

test("corrupt JSON falls back to empty records instead of throwing", async () => {
  const store = memStore();
  const key = await recordsKey(store);
  store.map.set(key, "{not valid json");
  assert.deepEqual(await loadRecords(store), EMPTY_RECORDS);
});

test("junk values are sanitized: negatives/NaN/strings drop to defaults", async () => {
  const store = memStore();
  const key = await recordsKey(store);
  store.map.set(key, JSON.stringify({ bestStreak: -5, bestTimeMs: "fast" }));
  assert.deepEqual(await loadRecords(store), { bestStreak: 0, bestTimeMs: null });
});

test("non-integer records are floored on load", async () => {
  const store = memStore();
  const key = await recordsKey(store);
  store.map.set(key, JSON.stringify({ bestStreak: 3.9, bestTimeMs: 1500.7 }));
  assert.deepEqual(await loadRecords(store), { bestStreak: 3, bestTimeMs: 1500 });
});
