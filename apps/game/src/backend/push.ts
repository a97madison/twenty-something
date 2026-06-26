/**
 * Client side of social push — thin auth'd REST calls to the registerPushToken
 * and reportChallengeResult callables (same `{ data }` → `{ result }` wire format
 * as daily.ts). Both are fire-and-forget: any failure (offline, backend off, no
 * token registered for the challenger) resolves quietly. The challenger is
 * identified by the playerId the challenge code carries.
 */
import type { KeyValueStore } from "../logic";
import { BACKEND_ENABLED, fnUrl } from "./config";
import { getIdToken } from "./auth";

async function callFn(store: KeyValueStore, name: string, data: unknown): Promise<unknown> {
  const idToken = await getIdToken(store);
  const r = await fetch(fnUrl(name), {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
    body: JSON.stringify({ data }),
  });
  return (await r.json())?.result ?? null;
}

/** Register this device's Expo push token under its stable playerId. */
export async function registerPushToken(store: KeyValueStore, playerId: string, token: string): Promise<boolean> {
  if (!BACKEND_ENABLED) return false;
  try {
    await callFn(store, "registerPushToken", { playerId, token });
    return true;
  } catch {
    return false;
  }
}

/** Tell the challenger's device how their challenge went (pushes if they opted in). */
export async function reportChallengeResult(
  store: KeyValueStore,
  challengerPlayerId: string,
  result: "win" | "loss" | "tie",
  accepterName: string,
): Promise<void> {
  if (!BACKEND_ENABLED || !challengerPlayerId) return;
  try {
    await callFn(store, "reportChallengeResult", { challengerPlayerId, result, accepterName });
  } catch {
    // Quietly ignore — the rematch ping is best-effort.
  }
}
