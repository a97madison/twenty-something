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
  /** Whether today's daily has already been played. */
  playedToday: boolean;
}

/** How long before local midnight to warn that a live streak is about to lapse. */
export const STREAK_RISK_LEAD_HOURS = 3;

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
      plan.push({
        id: "streak-risk",
        fireAtMs,
        title: "Don't break the chain",
        body: `🔥 Your ${i.streak}-day streak ends in ${STREAK_RISK_LEAD_HOURS} hours — play today's challenge.`,
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
