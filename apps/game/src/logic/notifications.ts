/**
 * Notification PLANNER — pure, UI-free, fully node-testable.
 *
 * This decides WHAT to schedule and WHEN, following the retention best practice
 * of daily-puzzle apps (Wordle / NYT / 2048): few, smart, personalized beats
 * frequent. The OS glue that actually delivers these (expo-notifications) is a
 * thin separate layer — it takes this plan and schedules each note by its stable
 * id (cancel-all then re-add on every launch so nothing drifts). Keeping the
 * brain here means the timing + copy are tested without a device.
 *
 * Absolute fire timestamps that depend on the device's local calendar (next
 * midnight, the morning nudge slot) are computed at the screen boundary and
 * passed in, so this module stays pure and deterministic.
 */

const HOUR_MS = 3_600_000;

/** A single scheduled local notification. `id` is stable so it can be replaced. */
export interface NotePlan {
  id: string;
  fireAtMs: number;
  title: string;
  body: string;
}

/** Local-calendar facts the screen computes and hands to the planner. */
export interface NotifyInputs {
  nowMs: number;
  /** Absolute ms of the user's next local midnight (when the daily resets). */
  nextMidnightMs: number;
  /** Absolute ms of the next friendly "come play" slot, e.g. tomorrow ~9am local. */
  nextNudgeMs: number;
  /** Absolute ms of the next weekly reset (Monday 00:00 UTC, from msUntilWeeklyReset). */
  nextWeeklyResetMs: number;
  /** Current daily streak (consecutive days completed). */
  streak: number;
  /** Banked streak freezes — softens the at-risk warning when you're covered. */
  freezes: number;
  /** Whether today's daily has already been played. */
  playedToday: boolean;
}

/** How long before local midnight to warn that a live streak is about to lapse. */
export const STREAK_RISK_LEAD_HOURS = 3;

/** Streak length that completes a perfect week (mirrors engine PERFECT_WEEK). */
const PERFECT_WEEK = 7;

/**
 * Build the list of notifications to (re)schedule for this device right now.
 * Always returns the daily nudge + weekly recap; adds the streak-at-risk warning
 * only when there's a live streak that today's play hasn't yet protected.
 */
export function planNotifications(i: NotifyInputs): NotePlan[] {
  const plan: NotePlan[] = [];

  // 1. Streak-at-risk — the single highest-value retention nudge (loss aversion).
  //    Only if you actually have a streak and haven't locked it in today.
  if (i.streak > 0 && !i.playedToday) {
    const fireAtMs = i.nextMidnightMs - STREAK_RISK_LEAD_HOURS * HOUR_MS;
    if (fireAtMs > i.nowMs) {
      // One more day completes a perfect week → lead with that carrot; otherwise
      // soften the warning if a freeze has you covered, else the urgent version.
      const perfectWeekNext = (i.streak + 1) % PERFECT_WEEK === 0;
      const body = perfectWeekNext
        ? `🎉 One more day for a perfect week! Finish your ${i.streak}-day streak and bank a free freeze.`
        : i.freezes > 0
          ? `🔥 Your ${i.streak}-day streak is at risk — a freeze can save it, but keep the run alive.`
          : `🔥 Your ${i.streak}-day streak ends in ${STREAK_RISK_LEAD_HOURS} hours — play today's challenge.`;
      plan.push({
        id: "streak-risk",
        fireAtMs,
        title: perfectWeekNext ? "Perfect week within reach" : "Don't break the chain",
        body,
      });
    }
  }

  // 2. Daily nudge — a gentle pull at a good local hour, never at the midnight reset.
  plan.push({
    id: "daily-nudge",
    fireAtMs: i.nextNudgeMs,
    title: "Today's hand is dealt",
    body: "A fresh daily challenge is waiting ☕",
  });

  // 3. Weekly recap / reset — climb back up when the season turns over.
  plan.push({
    id: "weekly-recap",
    fireAtMs: i.nextWeeklyResetMs,
    title: "New week, new ratings",
    body: "Weekly ratings just reset — climb back to the top ⭐",
  });

  return plan;
}
