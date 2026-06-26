/**
 * Anonymous Firebase identity over plain REST (no SDK). Signs the device up once,
 * persists the long-lived refresh token, and exchanges it for a short-lived ID
 * token as needed — giving every device a STABLE anonymous uid, which is what the
 * server's first-submit-locks rule (and future streaks) hang off of.
 */
import type { KeyValueStore } from "../logic";
import { SIGNUP_URL, REFRESH_URL } from "./config";

/** Where the rotating refresh token lives (the durable half of the identity). */
const REFRESH_KEY = "twenty-something:auth-refresh";

/** In-memory cache of the current ID token (short-lived, ~1h). */
let cached: { idToken: string; expiresAt: number } | null = null;

async function signUp(): Promise<{ idToken: string; refreshToken: string; expiresIn: string }> {
  const r = await fetch(SIGNUP_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ returnSecureToken: true }),
  });
  const j = await r.json();
  if (!r.ok || !j.idToken) throw new Error("anonymous sign-up failed");
  return j;
}

async function refresh(refreshToken: string): Promise<{ id_token: string; refresh_token: string; expires_in: string }> {
  // The secure-token endpoint takes form-encoding, not JSON.
  const r = await fetch(REFRESH_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=refresh_token&refresh_token=${encodeURIComponent(refreshToken)}`,
  });
  const j = await r.json();
  if (!r.ok || !j.id_token) throw new Error("token refresh failed");
  return j;
}

/**
 * A valid anonymous ID token for this device, minting or refreshing as needed.
 * Throws on network/auth failure (callers treat that as "backend unavailable").
 */
export async function getIdToken(store: KeyValueStore): Promise<string> {
  if (cached && cached.expiresAt - 60_000 > Date.now()) return cached.idToken;

  const stored = await store.getItem(REFRESH_KEY);
  if (stored) {
    const j = await refresh(stored);
    cached = { idToken: j.id_token, expiresAt: Date.now() + Number(j.expires_in) * 1000 };
    await store.setItem(REFRESH_KEY, j.refresh_token);
    return cached.idToken;
  }

  const j = await signUp();
  cached = { idToken: j.idToken, expiresAt: Date.now() + Number(j.expiresIn) * 1000 };
  await store.setItem(REFRESH_KEY, j.refreshToken);
  return cached.idToken;
}

/** Decode the uid (sub) from a Firebase ID token's JWT payload — no verification
 *  needed client-side (the server re-verifies); we just need to know who we are. */
function uidFromToken(idToken: string): string {
  const payload = idToken.split(".")[1] ?? "";
  const json = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
  return (JSON.parse(json).user_id as string) ?? (JSON.parse(json).sub as string) ?? "";
}

/** This device's anonymous uid (so the rooms UI can tell which player is "me"). */
export async function getUid(store: KeyValueStore): Promise<string> {
  return uidFromToken(await getIdToken(store));
}
