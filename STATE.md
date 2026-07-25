# twenty-something-workspace: current state (STATE.md)

Always-loaded spine (auto-injected each session by the SessionStart hook). Keep under 120 lines. Current truth only. History lives in journal/, deep reference in the mapped files below. Search everything with /brain <query>.

> DRAFT (2026-07-25): auto-generated from project sources, Anthony to confirm/correct.

## Right now
- A card arithmetic game (classic **24** + **20-Something** variant, target = 18 + the 4th card) plus companion tools. npm-workspaces monorepo, one tested engine (`@twenty-something/core`) behind every surface.
- The **game** (`apps/game`) is the focus and is in strong shape: daily challenge, per-variant stats (accuracy / avg time / ★ rating), live rooms, friend challenges, daily percentile all shipped.
- Web build is HOSTED & LIVE at https://twenty-something-anthonydm.web.app (Firebase Hosting serves the Expo web export; challenge links open in-browser, no install).
- Daily percentile is LIVE in prod (Firebase project `twenty-something-anthonydm`, us-central1, node22, Blaze).

## In flight
- **UNCOMMITTED on main (2026-06-29 session):** playtest fixes (wrong submit now advances the hand), rating leniency recalibration (SLOW_MS 60s to 90s), wrong-result red target pill, cream app icon, calculator white card faces, stats gate copy, `docs/MARKETING.md`. Full suite green (170 tests), both apps driven on iOS sim. Needs commit + merge per CLAUDE.md §6/§7.
  - When committing: EXCLUDE `apps/game/src/screens/InstructionsScreen.tsx` (modified in tree but from another stream, not this session's work).

## Next (priority order)
1. Commit + merge the 2026-06-29 working-tree changes (branch off main, stage by explicit path, run full suite, merge + push). Exclude InstructionsScreen.tsx.
2. **EAS dev-build milestone** (the single next real gate): unblocks App Check (App Attest / Play Integrity), OS notification delivery (wire `expo-notifications` to the existing `planNotifications` brain), and App Store / Play distribution. `apps/game/eas.json` exists; remaining steps are all account-gated (`eas login`, Apple Developer + Play Console).
3. Wire the other two deployed callables to the client (`submitDaily` streak, `submitRoomSolution` rooms) and set their public `allUsers` run.invoker (they 401 until then).
4. Growth per `docs/MARKETING.md`: image share card as real PNG (gated on dev build), deep links, web landing, concentrated launch week (PH + HN + Reddit).

## Open questions / blockers
- **No EAS dev build yet** gates App Check, live notifications, and store distribution. Expo Go cannot do App Attest / Play Integrity / reliable scheduled notifications.
- Percentile is a casual, gameable leaderboard until App Check lands (anyone can mint an anon token + submit). Low stakes; Firestore is default-deny, server-writes only. Budget alert is the interim guard.
- Image share card is view-only until `react-native-view-shot` is added (works on web now, needs the dev build on native).
- Custom domain for the web build is an open polish item.

## Canonical file map (one home per topic)
- Game rules engine (types, target, solver, evaluator, validation, share-text, canonical dedup) -> `packages/core/src/` (NEVER reimplement game logic outside core)
- Shared input/UI layer (CardRow, Keypad, CalcPad, PlayingCard, theme tokens, fonts, card PNGs) -> `packages/ui/src/` + `packages/ui/assets/`
- The game app (screens, engine, backend REST client) -> `apps/game/src/` (`logic/engine.ts`, `screens/`, `backend/`)
- Calculator app (solver + checker modes) -> `apps/calculator/src/`
- Cloud Functions (daily percentile, rooms, push, analytics) -> `functions/src/` + `functions/backend/`
- Firebase config -> `firebase.json`, `.firebaserc`, `firestore.rules` (default-deny), `firestore.indexes.json`
- Canonical product/architecture plan (reset model, determinism, backend, distribution) -> `docs/ROADMAP.md`
- Go-viral marketing plan -> `docs/MARKETING.md`
- Full working memory / session history -> `notes.md` (gitignored, local only)
- Privacy policy -> `PRIVACY.md`

## Conventions (do not break)
- Tests: `node --test` with `--experimental-strip-types`; test files import siblings with `.ts` extension. No Jest/Vitest. Run all from root: `npm test`. Build runs first via pretest.
- App imports core's built `dist`, not source: run `npm run build -w @twenty-something/core` before building/running apps.
- Operators are unicode `×` and `÷` (not ASCII). Binary operators only.
- Keep the **Expo SDK 56 dep graph frozen**: no new RN deps without care; animations use RN built-in `Animated` (no reanimated). Firebase is server-only, never in the RN bundle.
- Android toolchain: AVD `twentysomething` (Pixel 7, API 36); `emulator -avd twentysomething` then `cd apps/game && npx expo start --android`.
