// End-to-end test of the social-push callables against the local emulators:
// reporting a result for an UNregistered challenger no-ops; after the challenger
// registers a push token, a report finds it and attempts the send.
//
// Run via:  npm run test:emulator:push
import assert from "node:assert/strict";

const AUTH = "http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo";
const FN = (name) => `http://127.0.0.1:5001/demo-ts/us-central1/${name}`;

async function newUser() {
  const r = await fetch(AUTH, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ returnSecureToken: true }),
  });
  return (await r.json()).idToken;
}
async function call(name, token, data) {
  const r = await fetch(FN(name), {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify({ data }),
  });
  return r.json();
}

let passed = 0;
const ok = (l) => { console.log("  ok -", l); passed++; };

const challenger = await newUser();
const accepter = await newUser();
const CHALLENGER_PID = "pid-abc123";

// 1. No token registered → reporting a result no-ops (sent:false).
const before = (await call("reportChallengeResult", accepter, { challengerPlayerId: CHALLENGER_PID, result: "win", accepterName: "Sam" })).result;
assert.equal(before.sent, false, "no token → not sent");
ok("report no-ops when the challenger has no push token");

// 2. Bad token registration is rejected.
const bad = await call("registerPushToken", challenger, { playerId: CHALLENGER_PID, token: "nope" });
assert.ok(bad.error, "non-Expo token rejected");
ok("registerPushToken rejects a malformed token");

// 3. Register a (fake but well-formed) Expo token, then report → token found, send attempted.
await call("registerPushToken", challenger, { playerId: CHALLENGER_PID, token: "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]" });
const after = (await call("reportChallengeResult", accepter, { challengerPlayerId: CHALLENGER_PID, result: "win", accepterName: "Sam" })).result;
assert.equal(after.sent, true, "token present → send attempted");
ok("after registration, a report finds the token and sends");

// 4. A bad result value is rejected.
const badResult = await call("reportChallengeResult", accepter, { challengerPlayerId: CHALLENGER_PID, result: "lol" });
assert.ok(badResult.error, "invalid result rejected");
ok("reportChallengeResult validates the result value");

console.log(`\nPUSH INTEGRATION: ${passed}/4 assertions passed against the live emulator.`);
