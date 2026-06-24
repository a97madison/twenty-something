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

## 3. Daily percentile — BLOCKED on Firebase deploy

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

**To unblock (your action):** `firebase login`, create the project, `firebase init` (functions + firestore + emulator), add `firebase-admin`/`firebase-functions` to `functions/package.json`, write `firestore.rules` (deny direct writes; all scoring via the callable), deploy. Then run the emulator integration test for the **first-solver/percentile** path before shipping. This was already the repo's known blocker.

## 4. Notifications — BLOCKED on a dev build (logic ready)

> daily reset → notify; weekly rating reset → notify.

**Decision: local scheduled notifications, not push.** Both triggers are *time-based and identical for the device* (its local midnight; the UTC weekly instant) — so they need no server, no push tokens, no APNs/FCM cost, and work offline. (Push is only worth it later for social pokes: "someone beat your daily time.")

- **Daily:** `expo-notifications` calendar trigger, `{ hour: 0, minute: 0, repeats: true }` → fires at local midnight: *"New daily challenge is live 🃏"*.
- **Weekly:** schedule a one-shot at `now + msUntilWeeklyReset(now)` (already computed/tested), reschedule on each launch: *"Weekly ratings just reset — climb back up ⭐"*.
- Permission asked **after first daily completion** (ask when the value is obvious, not on a cold first launch). Re-arm both on every app start so they never drift.

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
1. **Share button** on the daily (built in core — just wire it). Growth + pride.
2. **Daily percentile** (§3) — turns a solo result into a competitive one.
3. **Streak freeze / "perfect week"** badges — loss-aversion keeps the streak alive.
4. **Win flourish** on a fast 5-star solve (confetti/sound) — the dopamine spike the quiet loop is missing.
5. **First-solve haptic + count-up** on the rating delta in Summary.

## Status at a glance

| Item | State |
|---|---|
| Weekly UTC reset + "Closes in Xd Yh" | ✅ shipped, tested |
| Daily local-midnight reset + "Next challenge in Xh Ym" | ✅ shipped, tested |
| Daily deterministic deck (same for all) | ✅ shipped, tested |
| Records as its own Stats section | ✅ shipped |
| Fractional star fill | ✅ shipped |
| Daily percentile | ⛔ needs Firebase deploy (logic done) |
| Notifications (daily + weekly) | ⛔ needs dev build (scheduling math done) |
| Share button | ⏳ core builder done, UI not wired |
| Store distribution | ⏳ needs EAS + store accounts |
