# 20-Something

A card arithmetic game and its companion tools. Flip four cards and combine all
four values with `+ − × ÷` to hit a target: classic **24**, or the **20-Something**
variant where the target is `18 + the 4th card`.

This is an npm-workspaces monorepo. One tested engine sits behind every surface —
the app, the (planned) web build, and the backend all import the same package, so
there is a single source of truth for the game's rules.

## Structure

```
packages/core        @twenty-something/core — the engine. Pure TypeScript:
                     types, target logic, solver, evaluator, validation,
                     share-text. No UI, no backend. Fully unit-tested.

functions            @twenty-something/functions — Cloud Functions for
                     authoritative scoring (daily streaks + online rooms).
                     Imports core's validator so the server and client agree
                     on what "correct" means.

apps/calculator      @twenty-something/calculator — Expo / React Native app.
                     A solver (enter four cards, see every solution) and a
                     checker (build your own expression, verify it). Imports
                     core; contains no game logic of its own.
```

## Develop

```bash
npm install                              # link workspaces, pull deps
npm run build -w @twenty-something/core  # build core (app imports its dist)
npm test                                 # run all package tests
```

## Run the calculator app

```bash
npm run build -w @twenty-something/core  # if you haven't already
cd apps/calculator
npx expo start                           # scan the QR with Expo Go
```

See `RUN.md` for first-run troubleshooting (the monorepo + Expo gotchas are
pre-handled in `apps/calculator/metro.config.js`).

## Tests

`core` and `functions` both have unit tests; run them all with `npm test` from
the root. The app's logic is core, so it's covered by core's tests; the UI
itself is verified by type-checking against core and the React Native types.
