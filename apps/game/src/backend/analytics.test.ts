import { test } from "node:test";
import assert from "node:assert/strict";

import { buildBatchBody, type QueuedEvent } from "./analyticsBatch.ts";

const events: QueuedEvent[] = [
  { event: "app_open", properties: {}, timestamp: "2026-06-26T00:00:00.000Z" },
  { event: "game_complete", properties: { mode: "daily", solved: 4 }, timestamp: "2026-06-26T00:01:00.000Z" },
];

test("buildBatchBody shapes a PostHog /batch/ payload", () => {
  const body = buildBatchBody(events, "phc_test", "device-123");
  assert.equal(body.api_key, "phc_test");
  assert.equal(body.batch.length, 2);
  const first = body.batch[0]!;
  assert.equal(first.event, "app_open");
  assert.equal(first.timestamp, "2026-06-26T00:00:00.000Z");
  assert.equal(first.properties.distinct_id, "device-123");
  assert.equal(first.properties.$lib, "twenty-something");
});

test("event props are preserved and merged with distinct_id", () => {
  const body = buildBatchBody(events, "k", "d");
  assert.deepEqual(body.batch[1]!.properties, {
    mode: "daily",
    solved: 4,
    distinct_id: "d",
    $lib: "twenty-something",
  });
});

test("an empty batch is valid (no events)", () => {
  const body = buildBatchBody([], "k", "d");
  assert.deepEqual(body, { api_key: "k", batch: [] });
});
