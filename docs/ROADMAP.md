# 20-Something — product & architecture decisions

Lead-engineer decisions for the daily/weekly model, the percentile backend,
notifications, distribution, and the addiction loop. Things marked **SHIPPED**
are in the app and tested now; **BLOCKED** items name the exact thing that
unblocks them (a deploy, a device build, a store account) — none are faked.

---

## 1. Reset model — SHIPPED

Two independent cadences, deliberately anchored differently:

| Window | Resets | Why |
|---|---|---|
| **Daily challenge** | each user's **local midnight** | a daily puzzle should flip "tomorrow" when *your* day flips, not at a foreign hour |
| **Weekly rating** | **Monday 00:00 UTC**, same instant worldwide | a leaderboard/season must close at one global moment or rankings are incomparable |

Implementation (pure, unit-tested in `engine.ts` / `format.ts`):
- `msUntilWeeklyReset(nowMs)` → next Monday 00:00 UTC (UTC-anchored, identical for everyone).
- `weeklyRollup()` now aggregates the **current Monday→Sunday week** (was a rolling 7-day window).
- `msUntilLocalMidnight(date)` + `formatHoursMinutes` → the daily countdown.
- UI: Stats & Summary show **"THIS WEEK (Closes in Xd Yh)"**; Home shows **"Next challenge in Xh Ym"** once today's daily is done.

Day buckets are keyed by the player's *local* date, so a weekly total can be off by the hands played in the few boundary hours where local date ≠ UTC date. That's invisible at rating granularity; if it ever matters, store a UTC `dayKey` alongside the local one. Not worth it now.

## 2. Daily challenge determinism — SHIPPED

Everyone playing the same date gets the **same hands**. `dealDailyHands(variant, dateKey)` seeds a mulberry32 PRNG from `FNV-1a(dateKey|variant)`, so the deck is a pure function of the date — no backend needed to agree on the puzzle. One attempt per day is enforced locally (`loadDailyDone`/`isDailyDone`).

This is the keystone that makes the percentile possible: since the server can regenerate the exact same puzzle from the date, it never trusts client-sent cards.

## 3. Daily percentile — ✅ LIVE

> "On completion, show what percentile they got vs everyone else who did the daily."

The **logic already exists** in `functions/` (`submitDaily`, `computePercentile`, `verify.ts`) and is unit-tested. What's missing is a *running* Firebase project. This is the one piece that fundamentally needs a server (a percentile is a fact about the whole field of players; it cannot be honestly synthesized on-device).

**Architecture (decided):**
- **Auth:** anonymous Firebase Auth on first launch — zero-friction, gives every device a stable uid for streaks + one-submit-per-day enforcement.
- **Firestore:**
  - `dailies/{dateKey}` — the day's result histogram: a fixed-bucket array of score counts (e.g. 100 buckets keyed by composite score). Append-only via `FieldValue.increment` inside a transaction.
  - `dailies/{dateKey}/entries/{uid}` — one doc per player (their score + solve time), guards against double submit.
  - `users/{uid}` — streak state.
- **Submit flow (callable `submitDaily`):** client sends the date + its solutions (not cards); server regenerates the puzzle, verifies with `@twenty-something/core`, computes the player's composite score, increments the histogram in a transaction, returns **percentile = % of entries at or below this score** via `computePercentile`. First write of the day creates the histogram.
- **Score:** reuse the client star model (accuracy + speed) as the composite so the percentile matches what the player sees.
- **Client:** Summary's "percentile coming with the online update" placeholder swaps for the real value behind a `BACKEND_ENABLED` flag; offline or pre-deploy, it degrades to the local rating with no dead UI.

**De-risked (done):** the scaffolding already exists (`firebase.json`, `.firebaserc`, default-deny `firestore.rules`, `functions/package.json` with `firebase-admin`/`firebase-functions`), and the **monorepo deploy trap is fixed**: `build:deploy` now esbuild-bundles `@twenty-something/core` *inline* into a self-contained `lib/index.js` (firebase SDKs stay external for the cloud install; **`@twenty-something/core` is removed from `functions/package.json` entirely** — esbuild inlines it locally via the workspace symlink, so Cloud Build's `npm install` never tries to fetch the private package). NOTE: moving core to *devDependencies* is NOT enough — Firebase's Cloud Build installs devDependencies too and 404s on the private package; it must be absent from the manifest. Verified: 0 workspace imports remain in the bundle, it's valid ESM, functions still typecheck + pass 25 tests + 5/5 e2e. So a cloud `npm install` can't choke on the unpublishable workspace package — the thing that would have silently broken every deploy.

**Still yours (account-gated):** `firebase login`, create the `twenty-something-dev` project, **enable Blaze billing** (2nd-gen functions require it), then `firebase deploy --only firestore:rules,functions`.

**Verified locally (done):** `npm run test:emulator` boots auth+firestore+functions on a `demo-ts` project (no login/billing) and runs `functions/integration/percentile.test.mjs` — **5/5 e2e assertions pass**: the bundled-core artifact loads in the real Firebase runtime, `submitDailyGameResult` enforces auth, a rating of 3 in a field of 5 returns the 60th percentile (mid-rank), the score locks on first submit (anti-fishing), and the two variant fields stay isolated. So the backend is proven correct and deployable — deploy is now purely your login/billing step.

### Security model + App Check (pre-launch hardening)

The deployed callables are **public at the IAM layer on purpose** (consumer
devices have no Google IAM credentials — a Firebase anon token isn't one), with
auth enforced *inside* each function (`requireUid`) and Firestore default-deny so
the DB is never client-reachable. That's the standard, safe Firebase model: no
data exposure. The only residual risk is **abuse** — anyone can mint a free
anonymous token and POST junk daily ratings to skew the casual percentile, or
spam the endpoint for invocation cost.

**App Check** is the fix (verifies a call came from your genuine app binary), but
it's a **milestone, not a toggle** — do NOT enable enforcement before the client
can mint tokens or every real call 401s:
1. **Client provider** needs a real build: iOS **App Attest** (Apple Developer app
   registration) / Android **Play Integrity** (Play Console) — neither works in
   Expo Go; both need an **EAS dev/prod build**. Web (if shipped) = reCAPTCHA
   Enterprise. Dev = the debug provider + a registered debug token.
2. **Client SDK**: App Check on RN means adopting the Firebase JS SDK (or
   @react-native-firebase) — heavier than the current zero-dep REST callable.
   Bundle this with the EAS build work (needed for the App Store + App Attest anyway).
3. **Server**: add `enforceAppCheck: true` to the `onCall` options (one line each).
4. **Rollout**: register app → run **UNENFORCED** (monitor metrics ~1–2 weeks to
   confirm real traffic passes) → *then* flip enforcement.

Until then: keep the budget alert on, accept that the percentile is a casual
(gameable) leaderboard, and ship. App Check lands with the dev-build milestone.

## 4. Notifications — BLOCKED on a dev build (logic ready)

> daily reset → notify; weekly rating reset → notify.

**Decision: local scheduled notifications, not push.** The retention triggers are *time-based and identical for the device* — no server, no push tokens, no APNs/FCM cost, works offline. (Push is only worth it later for social/competitive pokes that depend on the whole field.)

Best-practice principle (Wordle/NYT/2048): **fewer, smarter, personalized** beats frequent. Over-notifying gets you muted or uninstalled and OS-throttled. The slate, in priority order:

1. **Streak-at-risk** — *the* lever (pure loss-aversion; daily-game players guard streaks obsessively). Fire only if you have an active streak and haven't played today, a few hours before *your* local midnight: *"🔥 Your 12-day streak ends in 3 hours."* Personalize the number — that's what makes it land.
2. **Daily nudge at a good hour, NOT at the reset.** Don't fire at local midnight (nobody's awake, it's annoying) — fire mid-morning / early-evening (default ~9am; ideally learn the player's habitual play time), only if unplayed: *"Today's hand is dealt ☕."*
3. **Win-back, capped.** At 3 days and 7 days away, then **stop** (endless reminders cause the uninstall you're avoiding).
4. **Weekly recap on reset** — personalized, not generic: *"Your week: 23 hands, ★3.8 avg — your best yet."* Reschedule a one-shot at `now + msUntilWeeklyReset(now)` (already computed/tested) each launch.
5. **Streak milestone (positive):** "🎉 7-day streak!" on 7/30/100.

Implementation: `expo-notifications`; calendar trigger for the daily nudge, date trigger for the weekly recap, re-armed every launch so they never drift. Permission asked **after the first win/streak** (when value is obvious), with a per-category settings toggle, quiet hours, and deep-links straight to the daily. The scheduling math (`msUntilWeeklyReset`, `msUntilLocalMidnight`) is already pure + tested; wiring the service is ~30 lines.

**Why not shipped here:** `expo-notifications` needs native config + a development build to verify *delivery* (Expo Go can't reliably fire scheduled local notifications since SDK 53), and I won't add an unverifiable native dep to the frozen SDK-56 graph blind. The scheduling math it depends on (`msUntilWeeklyReset`, `msUntilLocalMidnight`) is already pure and tested — wiring the `expo-notifications` service is then ~30 lines.

## 5. Distribution & marketing — plan

**Positioning:** "Wordle for mental math." One shared daily puzzle, a 30-second brain hit, a number you compete on. Cozy paper-and-felt look, not a flashy hyper-casual game.

- **Stores:** iOS App Store + Google Play via EAS Build. ASO around "daily math game / 24 game / math puzzle". Screenshots must lead with the *hook*: the card hand + target + a fast solve time, then the daily/streak/stats. App icon = the felt-green wordmark.
- **Soft launch:** TestFlight + Play internal testing with 20–50 people; watch D1/D7 retention and daily-completion rate before paid anything.
- **Launch channels (free, intent-matched):** Product Hunt; r/math, r/puzzles, r/iosgaming; math-teacher / mental-math TikTok & Shorts (a 10-sec "can you make 24?" clip is the whole ad). Wordle proved daily-puzzle word-of-mouth needs no spend.
- **Viral loop:** `@twenty-something/core` **already has an outcome-only share builder** (time/streak/rarity, never the method — Wordle-style, no spoilers) that the app currently doesn't surface. Add a **Share** button on the daily Summary → this is the single highest-leverage growth feature and is mostly built. (Open product call: a 5-hand daily needs a share format — lead with total time + accuracy + percentile.)
- **Retention engine:** daily streak + the two notifications + the weekly rating reset + percentile bragging. These compound.

## 6. Addiction loop — what's working and what's next

The core loop is genuinely good: **variable reward** (a hand might be unsolvable, so every hand is a real judgment call, not a guaranteed win) + **speed pressure** (the live timer) + **streak** + **star rating**. Recently added beats: the reveal "curtain", the in-game streak, the daily/weekly countdowns.

Highest-ROI next additions, in order:
1. ~~**Share button** on the daily~~ — ✅ shipped (outcome-only, core `buildDailyShareText`).
2. **Daily percentile** (§3) — turns a solo result into a competitive one; backend code + deploy bundling done, needs the Firebase login/billing.
3. **Streak freeze / "perfect week"** badges — loss-aversion keeps the streak alive.
4. ~~**Win flourish** on a fast 5-star solve~~ ✅ shipped — a solve worth ≥4.5★ (≈ ≤16s) bursts a ring of felt-green stars over the cards + a heavy haptic. On-brand (no plastic confetti), built-in Animated, no new deps. Web-verified via a real solve.
5. ~~**First-solve haptic + count-up** on the rating delta in Summary.~~ ✅ shipped — the Summary headline rating counts up from 0 (stars + number in sync off one Animated.Value) and lands with a success haptic. Web-verified (0.26 mid-flight → 2.00 settled). Built-in Animated + expo-haptics, no new deps.

## Status at a glance

| Item | State |
|---|---|
| Weekly UTC reset + "Closes in Xd Yh" | ✅ shipped, tested |
| Daily local-midnight reset + "Next challenge in Xh Ym" | ✅ shipped, tested |
| Daily deterministic deck (same for all) | ✅ shipped, tested |
| Records as its own Stats section | ✅ shipped |
| Fractional star fill | ✅ shipped |
| **Daily share button (outcome-only)** | ✅ shipped, tested |
| **Functions deploy bundling (monorepo trap)** | ✅ fixed, verified |
| **Percentile backend (emulator-verified)** | ✅ 5/5 e2e passing vs live emulator (`npm run test:emulator`) |
| **Daily percentile (production)** | ✅ **LIVE** — deployed us-central1/node22, client wired (zero-dep REST), verified e2e vs prod |
| Notifications — scheduling brain | ✅ `planNotifications` built + tested (streak-risk / nudge / weekly) |
| Notifications — OS delivery | ⛔ needs `expo-notifications` + a dev build to verify firing |
| App Check (abuse hardening) | ⛔ needs the EAS dev build (App Attest / Play Integrity) — see §3 |
| Store distribution | ⏳ needs EAS + store accounts |
