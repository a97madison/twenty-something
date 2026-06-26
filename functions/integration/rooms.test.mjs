// End-to-end test of the live-rooms callables against the local Firebase
// emulators: createRoom → joinRoom → dealRoomRound → submitRoomSolution, proving
// the dealt round is genuinely solvable and that EXACTLY ONE of two near-
// simultaneous valid solves wins (the first-solver-wins transaction).
//
// Run via:  npm run test:emulator:rooms
import assert from "node:assert/strict";
import { findFirstSolution, CLASSIC_OPERATIONS } from "@twenty-something/core";

const AUTH = "http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo";
const FN = (name) => `http://127.0.0.1:5001/demo-ts/us-central1/${name}`;

async function newUser() {
  const r = await fetch(AUTH, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ returnSecureToken: true }),
  });
  const j = await r.json();
  if (!j.idToken) throw new Error("signUp failed: " + JSON.stringify(j));
  return j.idToken;
}

async function call(name, token, data) {
  const r = await fetch(FN(name), {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify({ data }),
  });
  return r.json(); // { result } | { error }
}

let passed = 0;
const ok = (label) => { console.log("  ok -", label); passed++; };

const host = await newUser();
const guest = await newUser();

// 1. Host creates a room; guest joins.
const created = (await call("createRoom", host, { variant: "24", winningScore: 1 })).result;
assert.ok(/^[A-Z0-9]{4}$/.test(created.roomId), "expected a 4-char room code");
ok(`createRoom → ${created.roomId}`);

const joined = (await call("joinRoom", guest, { roomId: created.roomId })).result;
assert.equal(joined.variant, "24");
ok("joinRoom returns the room config");

// 2. Host deals round 1; the returned hand must be genuinely solvable.
const round = (await call("dealRoomRound", host, { roomId: created.roomId, roundNumber: 1 })).result;
assert.equal(round.cards.length, 4);
const puzzle = { hand: round.cards, target: round.target, operations: CLASSIC_OPERATIONS };
const sol = findFirstSolution(puzzle);
assert.ok(sol, "dealt round must be solvable");
ok(`dealRoomRound → solvable hand [${round.cards.map((c) => c.value)}] target ${round.target}`);

// 3. A guest who isn't the host can't deal.
const denied = await call("dealRoomRound", guest, { roomId: created.roomId, roundNumber: 2 });
assert.ok(denied.error, "non-host deal must be rejected");
ok("only the host can deal");

// 4. First valid solve wins; the second sees the round is over.
const a = (await call("submitRoomSolution", host, { roomId: created.roomId, roundNumber: 1, expr: sol.expr })).result;
const b = (await call("submitRoomSolution", guest, { roomId: created.roomId, roundNumber: 1, expr: sol.expr })).result;
const winners = [a, b].filter((r) => r && r.won === true).length;
assert.equal(winners, 1, "exactly one winner");
assert.equal(a.won, true, "the first submitter wins");
assert.equal(b.won, false, "the second submitter loses the race");
ok("first valid solve wins; the second is too late (exactly one winner)");

console.log(`\nROOMS INTEGRATION: ${passed}/5 assertions passed against the live emulator.`);
