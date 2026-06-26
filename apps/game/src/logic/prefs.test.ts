import { test } from "node:test";
import assert from "node:assert/strict";

import { defaultPrefs, loadPrefs, savePrefs } from "./engine.ts";

function memStore() {
  const m = new Map<string, string>();
  return { getItem: async (k: string) => m.get(k) ?? null, setItem: async (k: string, v: string) => void m.set(k, v), m };
}

test("defaults are everything-on", () => {
  assert.deepEqual(defaultPrefs(), { haptics: true, sound: true, notifyDaily: true, notifyStreak: true, notifyWeekly: true });
});

test("missing prefs load as defaults", async () => {
  assert.deepEqual(await loadPrefs(memStore()), defaultPrefs());
});

test("prefs round-trip", async () => {
  const store = memStore();
  const p = { haptics: false, sound: true, notifyDaily: false, notifyStreak: true, notifyWeekly: false };
  await savePrefs(store, p);
  assert.deepEqual(await loadPrefs(store), p);
});

test("junk fields fall back to defaults, valid ones survive", async () => {
  const store = memStore();
  store.m.set("twenty-something:prefs", '{"haptics":false,"sound":"yes","notifyDaily":1}');
  const p = await loadPrefs(store);
  assert.equal(p.haptics, false, "valid boolean kept");
  assert.equal(p.sound, true, "non-boolean → default");
  assert.equal(p.notifyDaily, true, "non-boolean → default");
});
