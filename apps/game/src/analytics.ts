/**
 * Dependency-free product analytics. `track(event, props)` forwards to a sink
 * installed at app start; with no sink it's a silent no-op. This lets us
 * instrument the funnel NOW without pulling an analytics SDK into the frozen
 * Expo-56 graph — the real sink (PostHog / Firebase / a tiny REST poster) plugs
 * in at the dev-build step via setAnalyticsSink, and every call site already
 * exists. Tracking must never break the app, so the sink is wrapped in try/catch.
 */

export type AnalyticsProps = Record<string, string | number | boolean | undefined>;
type Sink = (event: string, props: AnalyticsProps) => void;

/** Canonical event names — one place so call sites and the sink agree. */
export const Events = {
  AppOpen: "app_open",
  GameStart: "game_start",
  GameComplete: "game_complete",
  ChallengeCreated: "challenge_created",
  ChallengeAccepted: "challenge_accepted",
  ChallengeResult: "challenge_result",
  DeepLinkOpen: "deep_link_open",
  ShareResult: "share_result",
  ShareChallenge: "share_challenge",
  SettingsChanged: "settings_changed",
  DataDeleted: "data_deleted",
} as const;

let sink: Sink | null = null;

/** Install the analytics sink at app start (or null to disable). */
export function setAnalyticsSink(next: Sink | null): void {
  sink = next;
}

/** Record a product event. Safe anywhere; no-ops until a sink is installed. */
export function track(event: string, props: AnalyticsProps = {}): void {
  if (!sink) return;
  try {
    sink(event, props);
  } catch {
    // Analytics must never break the app.
  }
}
