// End-to-end test of submitDailyGameResult against the local Firebase emulators.
//
// Run it (needs a JDK on PATH for the Firestore emulator + firebase-tools):
//   npm run test:emulator
// which builds the deploy bundle, boots auth+firestore+functions on the
// `demo-ts` project (no login/billing), runs this, then shuts them down.
//
// This proves the bundled-core deploy artifact actually LOADS and the percentile
// path works in the real Firebase runtime — beyond what typecheck can catch.
import assert from "node:assert/strict";

const AUTH = "http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo";
const FN = "http://127.0.0.1:5001/demo-ts/us-central1/submitDailyGameResult";

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

async function submit(token, data) {
  const r = await fetch(FN, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify({ data }),
  });
  return r.json(); // { result } | { error }
}

let passed = 0;
const ok = (label) => { console.log("  ok -", label); passed++; };

// 1. A lone player on a fresh date sits at the 50th percentile.
{
  const t = await newUser();
  const { result } = await submit(t, { date: "2026-07-01", variant: "24", rating: 4 });
  assert.equal(result.percentile, 50);
  assert.equal(result.fieldSize, 1);
  assert.equal(result.rating, 4);
  ok("lone player → 50th percentile, fieldSize 1");
}

// 2. A field of 5 ranks the mid-rank percentile correctly.
//    ratings [1,2,3,4] then a 5th player at 3 → below=2, equal=2 → (2+1)/5 = 60%.
{
  const date = "2026-07-02";
  for (const rating of [1, 2, 3, 4]) {
    const t = await newUser();
    await submit(t, { date, variant: "24", rating });
  }
  const me = await newUser();
  const { result } = await submit(me, { date, variant: "24", rating: 3 });
  assert.equal(result.fieldSize, 5);
  assert.equal(result.rating, 3);
  assert.equal(result.percentile, 60);
  ok("field of 5, rating 3 → 60th percentile (mid-rank)");

  // 3. First-submit-wins: re-submitting a different rating returns the LOCKED one.
  const replay = await submit(me, { date, variant: "24", rating: 5 });
  assert.equal(replay.result.rating, 3, "rating must lock on first submit");
  ok("replay locks the original rating (no fishing for a better score)");
}

// 4. Variant isolation: same date, different variant is a separate field.
{
  const t = await newUser();
  const { result } = await submit(t, { date: "2026-07-02", variant: "20_something", rating: 2 });
  assert.equal(result.fieldSize, 1, "20_something field is independent of the 24 field");
  ok("variant fields are isolated");
}

// 5. Auth is required — an unauthenticated call is rejected.
{
  const res = await submit(null, { date: "2026-07-03", variant: "24", rating: 4 });
  assert.ok(res.error, "expected an error for an unauthenticated call");
  ok("unauthenticated submit is rejected");
}

console.log(`\nINTEGRATION: ${passed}/5 assertions passed against the live emulator.`);
