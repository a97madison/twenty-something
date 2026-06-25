import { test } from "node:test";
import assert from "node:assert/strict";

import { dealSeededHands } from "./engine.ts";
import { encodeChallenge, decodeChallenge, challengeOutcome, type Challenge } from "./challenge.ts";

const sample: Challenge = { seed: "k3f9q2z1", variant: "20_something", hands: 5, rating: 3.8, name: "Riley" };

test("encode → decode round-trips every field", () => {
  const round = decodeChallenge(encodeChallenge(sample));
  assert.deepEqual(round, sample);
});

test("the 24 variant survives the round-trip", () => {
  const c: Challenge = { ...sample, variant: "24" };
  assert.equal(decodeChallenge(encodeChallenge(c))?.variant, "24");
});

test("the code carries the seed that re-deals identical hands", () => {
  const code = encodeChallenge(sample);
  const c = decodeChallenge(code)!;
  const a = dealSeededHands(c.seed, c.variant, c.hands);
  const b = dealSeededHands(sample.seed, sample.variant, sample.hands);
  assert.deepEqual(a.map((h) => h.values), b.map((h) => h.values));
});

test("rating is preserved to the tenth", () => {
  for (const r of [0, 2.5, 3.3, 5]) {
    assert.equal(decodeChallenge(encodeChallenge({ ...sample, rating: r }))?.rating, r);
  }
});

test("an empty name round-trips as empty", () => {
  const round = decodeChallenge(encodeChallenge({ ...sample, name: "" }));
  assert.equal(round?.name, "");
  assert.equal(round?.seed, sample.seed);
});

test("names are sanitized: separators stripped, length capped", () => {
  const c = decodeChallenge(encodeChallenge({ ...sample, name: "A.very.long.name.indeed.x" }));
  assert.ok(c);
  assert.ok(!c!.name.includes("."), "dots removed");
  assert.ok(c!.name.length <= 16, "name capped");
});

test("decode rejects junk, never throws", () => {
  for (const junk of ["", "hello", "TS1.20", "TS0.24.abc.5.30.x", "TS1.99.abc.5.30.x", "TS1.24.@@@.5.30.x"]) {
    assert.equal(decodeChallenge(junk), null, `should reject: ${junk}`);
  }
});

test("decode rejects out-of-range numbers", () => {
  assert.equal(decodeChallenge("TS1.24.abc.0.30.x"), null, "0 hands");
  assert.equal(decodeChallenge("TS1.24.abc.100.30.x"), null, "too many hands");
  assert.equal(decodeChallenge("TS1.24.abc.5.51.x"), null, "rating over 5.0");
  assert.equal(decodeChallenge("TS1.24.abc.5.-1.x"), null, "negative rating");
});

test("decode tolerates surrounding whitespace", () => {
  assert.equal(decodeChallenge("  TS1.24.abc.5.30.x  \n")?.seed, "abc");
});

test("challengeOutcome: win, loss, and a near-equal tie", () => {
  assert.equal(challengeOutcome(3.8, 3.4).result, "win");
  assert.equal(challengeOutcome(3.0, 4.2).result, "loss");
  assert.equal(challengeOutcome(3.8, 3.8).result, "tie");
  assert.equal(challengeOutcome(3.81, 3.79).result, "tie"); // within the rounding wash
  assert.equal(Number(challengeOutcome(3.8, 3.4).diff.toFixed(1)), 0.4);
});
