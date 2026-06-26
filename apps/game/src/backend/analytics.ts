/**
 * PostHog analytics sink — zero-dep HTTP capture, no SDK in the frozen Expo
 * graph. Events are micro-batched and POSTed to PostHog's /batch/ endpoint. The
 * payload shaping is a pure function (tested); the queue + flush + fetch are the
 * thin side-effecting wrapper. Install via setAnalyticsSink (see App).
 */

import { ANALYTICS_ENABLED, POSTHOG_HOST, POSTHOG_KEY } from "./config";
import { buildBatchBody, type QueuedEvent } from "./analyticsBatch";
import type { AnalyticsProps } from "../analytics";

export { buildBatchBody, type QueuedEvent };

/** Flush when the queue hits this many events… */
const FLUSH_AT = 20;
/** …or this long after the first un-flushed event. */
const FLUSH_MS = 4000;

/**
 * Create a PostHog sink, or null when analytics is disabled / unkeyed (so the
 * caller falls back to the dev console or no-op). `getDistinctId` is read at
 * flush time, so the stable device id can load after the sink is installed.
 */
export function createPostHogSink(
  getDistinctId: () => string,
): ((event: string, props: AnalyticsProps) => void) | null {
  if (!ANALYTICS_ENABLED || !POSTHOG_KEY) return null;
  let queue: QueuedEvent[] = [];
  let timer: ReturnType<typeof setTimeout> | null = null;

  const flush = () => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    if (queue.length === 0) return;
    const body = buildBatchBody(queue, POSTHOG_KEY, getDistinctId() || "anonymous");
    queue = [];
    fetch(`${POSTHOG_HOST}/batch/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).catch(() => {});
  };

  return (event, props) => {
    queue.push({ event, properties: props, timestamp: new Date().toISOString() });
    if (queue.length >= FLUSH_AT) flush();
    else if (!timer) timer = setTimeout(flush, FLUSH_MS);
  };
}
