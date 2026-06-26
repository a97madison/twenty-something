import { test } from "node:test";
import assert from "node:assert/strict";

import { buildExpoPushMessage, challengeResultPush, isExpoPushToken } from "./push.ts";

test("buildExpoPushMessage shapes an Expo push payload", () => {
  const m = buildExpoPushMessage("ExponentPushToken[abc]", "Title", "Body", { kind: "x" });
  assert.deepEqual(m, { to: "ExponentPushToken[abc]", title: "Title", body: "Body", sound: "default", data: { kind: "x" } });
});

test("buildExpoPushMessage omits data when absent", () => {
  const m = buildExpoPushMessage("t", "T", "B");
  assert.equal("data" in m, false);
});

test("challengeResultPush reads from the challenger's POV", () => {
  assert.match(challengeResultPush("Sam", "win").body, /Sam beat your challenge/);
  assert.match(challengeResultPush("Sam", "loss").body, /couldn't beat you/);
  assert.match(challengeResultPush("Sam", "tie").body, /tied your challenge/);
});

test("a blank accepter name falls back to 'A friend'", () => {
  assert.match(challengeResultPush("  ", "win").body, /A friend beat your challenge/);
});

test("isExpoPushToken validates the token shape", () => {
  assert.equal(isExpoPushToken("ExponentPushToken[xxxxxxxx]"), true);
  assert.equal(isExpoPushToken("nope"), false);
  assert.equal(isExpoPushToken(123), false);
  assert.equal(isExpoPushToken("ExponentPushToken[]"), false);
});
