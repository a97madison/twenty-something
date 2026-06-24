/**
 * Shareable result text — the PUBLIC surface a player posts.
 *
 * Design rule: share OUTCOME, never METHOD. The public string reveals nothing
 * about how the puzzle was solved — not the solution, not its structure, not
 * the operations used. Revealing any of that would spoil or hint the daily for
 * players who haven't gone yet. Like Wordle's grid, this shows how you did, not
 * how it's done. The player sees their own real solution privately elsewhere.
 *
 * Solve time is the headline brag: it's the thing players actually compete on.
 */

import type { Hand, Variant } from "./types.ts";
import { computeTarget } from "./target.ts";

/** Canonical public display name for each variant. */
export const VARIANT_NAME: Record<Variant, string> = {
  "24": "24",
  "20_something": "20-Something",
};

/** What the app passes in to build a share string. */
export interface ShareableResult {
  gameName: string; // e.g. "20-Something" or "24"
  date: string; // "YYYY-MM-DD"
  target: number;
  solved: boolean;
  solveTimeSec?: number;
  attempts?: number;
  currentStreak?: number;
  /** Optional server-computed rarity, e.g. "top 8%". Outcome, not method. */
  rarity?: string;
  /** Optional link appended at the end. */
  url?: string;
}

/** Play-specific fields for a share — everything except name and target. */
export interface ShareOutcome {
  date: string;
  solved: boolean;
  solveTimeSec?: number;
  attempts?: number;
  currentStreak?: number;
  rarity?: string;
  url?: string;
}

/**
 * Build a correctly-labeled, target-consistent ShareableResult for a given
 * variant and hand. This is the safe way to make a share: the game name and
 * the target are both derived here, so a "24" share can't accidentally show a
 * 20-something target, and a 20-something share's target always matches the
 * actual hand (18 + the 4th card) rather than whatever a caller typed.
 */
export function buildVariantShare(
  variant: Variant,
  hand: Hand,
  outcome: ShareOutcome,
): ShareableResult {
  return {
    gameName: VARIANT_NAME[variant],
    target: computeTarget(variant, hand),
    ...outcome,
  };
}

/** Format seconds as m:ss. */
export function formatTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/**
 * Build the public share text. OUTCOME-ONLY — nothing about the method ever
 * appears. Solve time is featured as the headline.
 */
export function buildShareText(result: ShareableResult): string {
  const lines: string[] = [];
  lines.push(`${result.gameName} · ${result.date}`);
  lines.push(`Target ${result.target}`);

  if (result.solved) {
    // Solve time is the headline brag, on its own line, first.
    if (typeof result.solveTimeSec === "number") {
      lines.push(`⚡ Solved in ${formatTime(result.solveTimeSec)}`);
    } else {
      lines.push("✅ Solved");
    }

    const detail: string[] = [];
    if (typeof result.attempts === "number") {
      detail.push(`🎯 ${result.attempts} ${result.attempts === 1 ? "try" : "tries"}`);
    }
    if (result.rarity) detail.push(`🏅 ${result.rarity}`);
    if (detail.length) lines.push(detail.join(" · "));

    if (typeof result.currentStreak === "number" && result.currentStreak > 0) {
      lines.push(`🔥 ${result.currentStreak} day streak`);
    }
  } else {
    lines.push("❌ Didn't crack it today");
    if (typeof result.currentStreak === "number" && result.currentStreak > 0) {
      lines.push(`🔥 ${result.currentStreak} day streak`);
    }
  }

  if (result.url) lines.push(result.url);
  return lines.join("\n");
}
