/**
 * Social push notifications via Expo's push service — the one class of nudge
 * that CAN'T be a local notification, because no device knows when your friend
 * accepts your challenge. The accepter's app reports the result; we look up the
 * challenger's registered push token (keyed by their stable playerId, which the
 * challenge code already carries) and send an Expo push. The copy + payload
 * shaping are pure here; the callables + the HTTP send live in index.ts.
 */

export type ChallengeResult = "win" | "loss" | "tie";

/** An Expo push message (https://docs.expo.dev/push-notifications/sending-notifications/). */
export interface ExpoPushMessage {
  to: string;
  title: string;
  body: string;
  sound: "default";
  data?: Record<string, unknown>;
}

export function buildExpoPushMessage(
  token: string,
  title: string,
  body: string,
  data?: Record<string, unknown>,
): ExpoPushMessage {
  return { to: token, title, body, sound: "default", ...(data ? { data } : {}) };
}

/**
 * Copy for "your friend played your challenge", from the CHALLENGER's point of
 * view. `result` is the ACCEPTER's outcome, so an accepter "win" means the
 * challenger was beaten.
 */
export function challengeResultPush(accepterName: string, result: ChallengeResult): { title: string; body: string } {
  const who = accepterName.trim() || "A friend";
  const title = "Your challenge was answered";
  if (result === "win") return { title, body: `😤 ${who} beat your challenge — rematch?` };
  if (result === "loss") return { title, body: `🏆 ${who} tried your challenge but couldn't beat you.` };
  return { title, body: `🤝 ${who} tied your challenge.` };
}

/** Whether a string looks like an Expo push token (cheap shape guard). */
export function isExpoPushToken(token: unknown): token is string {
  return typeof token === "string" && /^ExponentPushToken\[.+\]$/.test(token);
}
