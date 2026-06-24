/**
 * Pure screen-layer helpers shared across the game screens: card pips, clock
 * formatting, the local day key for stats bucketing, expression rendering, and
 * turning a validation failure into a one-line player message. Kept UI-free and
 * (except localDayKey, which reads the clock at the screen boundary) pure, so
 * the testable ones can be node-tested like the engine.
 */
import { safeEvaluate, type Expr, type Variant, type ValidationError } from "@twenty-something/core";
import type { CheckerToken } from "@twenty-something/ui";

/** Human label for a variant. */
export function variantLabel(v: Variant): string {
  return v === "24" ? "24" : "20-Something";
}

/** A–K letters for face cards, plain number otherwise. */
export function pip(v: number): string {
  if (v === 1) return "A";
  if (v === 11) return "J";
  if (v === 12) return "Q";
  if (v === 13) return "K";
  return String(v);
}

/** mm:ss for the live timer. */
export function formatClock(ms: number): string {
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** Compact solve time: "8.2s" under a minute, otherwise m:ss. */
export function formatSolve(ms: number): string {
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return formatClock(ms);
}

/** Local "YYYY-MM-DD" — computed at the screen boundary so the engine stays pure. */
export function localDayKey(d: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Render the in-progress token sequence as a readable expression string. */
export function tokenStr(tokens: CheckerToken[], values: number[]): string {
  return tokens
    .map((t) => {
      if (t.type === "card") return pip(values[t.i]!);
      if (t.type === "op") return ` ${t.op} `;
      return t.type === "lp" ? "(" : ")";
    })
    .join("");
}

/** One-line player-facing detail for a wrong submission. */
export function wrongFeedbackText(error: ValidationError, expr: Expr, target: number): string {
  if (error === "wrong_value") {
    const v = safeEvaluate(expr);
    const shown = v === null ? "—" : Number.isInteger(v) ? String(v) : v.toFixed(2);
    return `that makes ${shown}, not ${target} — keep going`;
  }
  if (error === "illegal_arithmetic") return "illegal arithmetic (division by zero)";
  if (error === "wrong_cards") return "use each of the four cards exactly once";
  return "not a valid solution — try another combination";
}

/** Format a rating (★) to two decimals, or a dash when there isn't one yet. */
export function formatRating(r: number | null): string {
  return r === null ? "—" : r.toFixed(2);
}

/** Format an accuracy fraction as a percentage, or a dash. */
export function formatAccuracy(a: number | null): string {
  return a === null ? "—" : `${Math.round(a * 100)}%`;
}
