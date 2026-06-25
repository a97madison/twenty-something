/**
 * Submit a finished daily's rating to the server and get the field percentile.
 * Calls the `submitDailyGameResult` callable directly over HTTPS (the callable
 * wire format is just `{ data }` → `{ result }`). Any failure (offline, backend
 * off) resolves to null so the Summary degrades cleanly to the local rating.
 */
import type { Variant } from "@twenty-something/core";
import type { KeyValueStore } from "../logic";
import { BACKEND_ENABLED, fnUrl } from "./config";
import { getIdToken } from "./auth";

/** The server's ranking of this daily result against the whole field. */
export interface DailyPercentile {
  /** The player's locked rating (0–5). */
  rating: number;
  /** Percent of the field at or below this rating (mid-rank). */
  percentile: number;
  /** How many players have submitted for this date+variant. */
  fieldSize: number;
}

export async function submitDailyResult(
  store: KeyValueStore,
  date: string,
  variant: Variant,
  rating: number,
): Promise<DailyPercentile | null> {
  if (!BACKEND_ENABLED) return null;
  try {
    const idToken = await getIdToken(store);
    const r = await fetch(fnUrl("submitDailyGameResult"), {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
      body: JSON.stringify({ data: { date, variant, rating } }),
    });
    const j = await r.json();
    if (j?.result && typeof j.result.percentile === "number") {
      return j.result as DailyPercentile;
    }
    return null;
  } catch {
    return null;
  }
}
