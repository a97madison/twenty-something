import { test } from "node:test";
import assert from "node:assert/strict";

import { track, setAnalyticsSink, Events } from "./analytics.ts";

test("no-ops with no sink installed", () => {
  setAnalyticsSink(null);
  assert.doesNotThrow(() => track(Events.AppOpen));
});

test("forwards event + props to the installed sink", () => {
  const seen: Array<[string, Record<string, unknown>]> = [];
  setAnalyticsSink((e, p) => seen.push([e, p]));
  track(Events.GameComplete, { mode: "daily", solved: 4, total: 5 });
  assert.deepEqual(seen, [["game_complete", { mode: "daily", solved: 4, total: 5 }]]);
  setAnalyticsSink(null);
});

test("a throwing sink never propagates", () => {
  setAnalyticsSink(() => {
    throw new Error("sink boom");
  });
  assert.doesNotThrow(() => track(Events.ShareResult));
  setAnalyticsSink(null);
});
