import { test } from "node:test";
import assert from "node:assert/strict";

import { emptyRivals, friendKey, recordRivalGame, loadRivals, saveRivals, type Rivals } from "./engine.ts";

test("friendKey prefers the playerId, falls back to a normalized name", () => {
  assert.equal(friendKey("ab12", "Riley"), "id:ab12");
  assert.equal(friendKey("", "Riley"), "name:riley");
  assert.equal(friendKey(undefined, "  Riley  "), "name:riley");
  assert.notEqual(friendKey("ab12", "Riley"), friendKey("cd34", "Riley"), "same name, different ids stay distinct");
});

test("recordRivalGame tallies wins/losses/ties and tracks the last day", () => {
  const k = friendKey("ab12", "Riley");
  let r: Rivals = emptyRivals();
  r = recordRivalGame(r, k, "Riley", "win", "2026-06-25");
  r = recordRivalGame(r, k, "Riley", "win", "2026-06-26");
  r = recordRivalGame(r, k, "Riley", "loss", "2026-06-27");
  r = recordRivalGame(r, k, "Riley", "tie", "2026-06-28");
  assert.deepEqual(r[k], { name: "Riley", wins: 2, losses: 1, ties: 1, lastPlayed: "2026-06-28" });
});

test("the latest non-empty name wins; an empty name keeps the old one", () => {
  const k = friendKey("ab12", "Riley");
  let r = recordRivalGame(emptyRivals(), k, "Riley", "win", "2026-06-25");
  r = recordRivalGame(r, k, "Ri", "loss", "2026-06-26");
  assert.equal(r[k]!.name, "Ri");
  r = recordRivalGame(r, k, "  ", "win", "2026-06-27");
  assert.equal(r[k]!.name, "Ri", "blank name doesn't clobber");
});

test("two friends are tracked independently", () => {
  let r = recordRivalGame(emptyRivals(), friendKey("a", "Ann"), "Ann", "win", "2026-06-25");
  r = recordRivalGame(r, friendKey("b", "Bo"), "Bo", "loss", "2026-06-25");
  assert.equal(Object.keys(r).length, 2);
  assert.equal(r[friendKey("a", "Ann")]!.wins, 1);
  assert.equal(r[friendKey("b", "Bo")]!.losses, 1);
});

test("persistence round-trips and sanitizes junk", async () => {
  const m = new Map<string, string>();
  const store = { getItem: async (k: string) => m.get(k) ?? null, setItem: async (k: string, v: string) => void m.set(k, v) };

  const k = friendKey("ab12", "Riley");
  const r = recordRivalGame(emptyRivals(), k, "Riley", "win", "2026-06-25");
  await saveRivals(store, r);
  assert.deepEqual(await loadRivals(store), r);

  m.set("twenty-something:rivals", '{"id:x":{"name":5,"wins":"NaN","losses":2}}');
  const cleaned = await loadRivals(store);
  assert.deepEqual(cleaned["id:x"], { name: "", wins: 0, losses: 2, ties: 0, lastPlayed: null });
});
