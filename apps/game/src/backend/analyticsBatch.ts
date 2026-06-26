/**
 * Pure PostHog payload shaping — kept config-free (only a type import, which is
 * erased) so node's test runner can load it without tripping on the backend
 * modules' extensionless Metro imports. The side-effecting sink lives in
 * analytics.ts and imports buildBatchBody from here.
 */

import type { AnalyticsProps } from "../analytics";

export interface QueuedEvent {
  event: string;
  properties: AnalyticsProps;
  /** ISO timestamp captured when the event fired. */
  timestamp: string;
}

/** Build the PostHog /batch/ request body. */
export function buildBatchBody(events: QueuedEvent[], apiKey: string, distinctId: string) {
  return {
    api_key: apiKey,
    batch: events.map((e) => ({
      event: e.event,
      timestamp: e.timestamp,
      properties: { ...e.properties, distinct_id: distinctId, $lib: "twenty-something" },
    })),
  };
}
