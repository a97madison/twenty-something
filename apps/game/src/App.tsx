import { useState, useEffect } from "react";
import { StyleSheet, Text, View, Pressable, ScrollView } from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import * as Haptics from "expo-haptics";
import { safeEvaluate, type Variant, type ValidationError } from "@twenty-something/core";
import {
  colors,
  fonts,
  radius,
  space,
  CardRow,
  Keypad,
  parseTokens,
  fillValues,
  type CheckerToken,
  type CardToken,
} from "@twenty-something/ui";

import {
  newGame,
  dealHands,
  submitSolution,
  claimNoSolution,
  giveUp,
  loadStats,
  saveStats,
  currentHand,
  type GameState,
  type AllStats,
} from "./logic";
import { storage } from "./storage";

const SUITS = [
  { s: "♠", red: false },
  { s: "♥", red: true },
  { s: "♦", red: true },
  { s: "♣", red: false },
];

/** Interim practice session length. Track S replaces this flow (play-setup → bounded session). */
const SESSION_HANDS = 10;

type Feedback = { kind: "solved" | "wrong"; big: string; sub: string };

function pip(v: number): string {
  if (v === 1) return "A";
  if (v === 11) return "J";
  if (v === 12) return "Q";
  if (v === 13) return "K";
  return String(v);
}

/** Local "YYYY-MM-DD" for per-day stats bucketing (computed at the screen boundary). */
function localDayKey(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Render the in-progress token sequence as a readable expression string. */
function tokenStr(tokens: CheckerToken[], values: number[]): string {
  return tokens
    .map((t) => {
      if (t.type === "card") return pip(values[t.i]!);
      if (t.type === "op") return ` ${t.op} `;
      return t.type === "lp" ? "(" : ")";
    })
    .join("");
}

/** mm:ss for the live timer. */
function formatClock(ms: number): string {
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** Compact solve time: "8.2s" under a minute, otherwise m:ss. */
function formatSolve(ms: number): string {
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return formatClock(ms);
}

/** Turn a validation failure into player-facing feedback. */
function wrongFeedback(error: ValidationError, expr: Parameters<typeof safeEvaluate>[0], target: number): Feedback {
  if (error === "wrong_value") {
    const v = safeEvaluate(expr);
    const shown = v === null ? "—" : Number.isInteger(v) ? String(v) : v.toFixed(2);
    return { kind: "wrong", big: `That makes ${shown}, not ${target}`, sub: "keep going — the clock's still running" };
  }
  if (error === "illegal_arithmetic") {
    return { kind: "wrong", big: "Illegal arithmetic", sub: "division by zero" };
  }
  if (error === "wrong_cards") {
    return { kind: "wrong", big: "Use each card once", sub: "all four cards, no repeats" };
  }
  return { kind: "wrong", big: "Not a valid solution", sub: "try another combination" };
}

/** Start a fresh interim practice session on the given variant, keeping stats. */
function freshGame(variant: Variant, stats?: AllStats): GameState {
  return newGame(variant, dealHands(variant, SESSION_HANDS), { now: Date.now(), stats });
}

export default function App() {
  const [game, setGame] = useState<GameState>(() => freshGame("24"));
  const [tokens, setTokens] = useState<CheckerToken[]>([]);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [tick, setTick] = useState<number>(() => Date.now());

  // Load saved stats once on mount and fold them in.
  useEffect(() => {
    let alive = true;
    loadStats(storage).then((stats) => {
      if (alive) setGame((g) => ({ ...g, stats }));
    });
    return () => {
      alive = false;
    };
  }, []);

  // Drive the live timer.
  useEffect(() => {
    const id = setInterval(() => setTick(Date.now()), 250);
    return () => clearInterval(id);
  }, []);

  // Auto-start the next interim session when this one is done.
  useEffect(() => {
    if (game.done) setGame(freshGame(game.variant, game.stats));
  }, [game.done, game.variant, game.stats]);

  const { variant, streak, session } = game;
  const hand = currentHand(game);
  const values = hand?.values ?? [];
  const elapsedMs = Math.max(0, tick - game.handStartedAt);
  const accuracy = session.total === 0 ? "—" : `${session.correct}/${session.total}`;
  const best = game.stats[variant];

  const usedIndices = tokens.filter((t) => t.type === "card").map((t) => (t as CardToken).i);
  const allFourUsed = [0, 1, 2, 3].every((i) => usedIndices.includes(i)) && usedIndices.length === 4;
  const canSubmit = hand != null && parseTokens(tokens) !== null && allFourUsed;

  const clearFeedback = () => {
    if (feedback) setFeedback(null);
  };

  const resetEntry = () => {
    setTokens([]);
    setFeedback(null);
  };

  const addCard = (i: number) => {
    if (usedIndices.includes(i)) return;
    Haptics.selectionAsync();
    setTokens([...tokens, { type: "card", i }]);
    clearFeedback();
  };

  const submit = () => {
    if (!hand) return;
    const tree = parseTokens(tokens);
    if (!tree) return;
    const expr = fillValues(tree, values);
    const out = submitSolution(game, expr, Date.now(), localDayKey());
    if (out.solved) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setGame(out.state);
      resetEntry();
      setFeedback({ kind: "solved", big: `Solved in ${formatSolve(out.elapsedMs)}`, sub: `★ ${out.stars.toFixed(1)}  ·  streak ${out.state.streak}` });
      saveStats(storage, out.state.stats).catch(() => {});
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      setFeedback(wrongFeedback(out.error, expr, hand.target));
    }
  };

  const noSolution = () => {
    if (!hand) return;
    const out = claimNoSolution(game, Date.now(), localDayKey());
    setGame(out.state);
    setTokens([]);
    if (out.correct) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setFeedback({ kind: "solved", big: "Correct — no solution", sub: `streak ${out.state.streak}` });
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setFeedback({ kind: "wrong", big: "It was solvable", sub: out.reveal?.solution ?? "—" });
    }
    saveStats(storage, out.state.stats).catch(() => {});
  };

  const pass = () => {
    if (!hand) return;
    const out = giveUp(game, Date.now(), localDayKey());
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    setGame(out.state);
    setTokens([]);
    setFeedback({
      kind: "wrong",
      big: "Passed",
      sub: out.reveal?.solution ? `e.g. ${out.reveal.solution}` : "no solution existed",
    });
    saveStats(storage, out.state.stats).catch(() => {});
  };

  const changeVariant = (v: Variant) => {
    if (v === variant) return;
    Haptics.selectionAsync();
    setGame(freshGame(v, game.stats));
    resetEntry();
  };

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.safe}>
        <StatusBar style="dark" />
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <Text style={styles.wordmark}>
              20<Text style={styles.wordmarkDot}>·</Text>Something
            </Text>
            <Text style={styles.tagline}>game</Text>
          </View>

          <View style={styles.variantbar}>
            <VariantTab label="24" active={variant === "24"} onPress={() => changeVariant("24")} />
            <VariantTab label="20-Something" active={variant === "20_something"} onPress={() => changeVariant("20_something")} />
          </View>

          <View style={styles.statsRow}>
            <Stat label="STREAK" value={String(streak)} />
            <Stat label="TIME" value={formatClock(elapsedMs)} emphasis />
            <Stat label="ACCURACY" value={accuracy} />
          </View>

          <View style={styles.recordsRow}>
            <Text style={styles.recordsText}>
              best streak {best.bestStreak}
              {"   ·   "}
              best time {best.bestTimeMs === null ? "—" : formatSolve(best.bestTimeMs)}
            </Text>
          </View>

          <View style={styles.targetReadout}>
            <Text style={styles.targetLabel}>MAKE</Text>
            <Text style={styles.targetNum}>{hand?.target ?? "—"}</Text>
          </View>

          <Text style={styles.cardsLabel}>Tap a card to add it — or judge the hand below</Text>
          {hand && (
            <CardRow
              values={values}
              suits={hand.suits}
              suitData={SUITS}
              variant={variant}
              mode="checker"
              usedIndices={usedIndices}
              onCardPress={addCard}
            />
          )}

          <Text style={styles.label}>Your expression</Text>
          <View style={styles.exprLine}>
            {tokens.length === 0 ? (
              <Text style={styles.placeholder}>tap cards and operators…</Text>
            ) : (
              <Text style={styles.exprText}>{tokenStr(tokens, values)}</Text>
            )}
          </View>

          <Keypad
            onPush={(t) => {
              setTokens((cur) => [...cur, t]);
              clearFeedback();
            }}
            onBackspace={() => {
              setTokens((cur) => cur.slice(0, -1));
              clearFeedback();
            }}
          />

          <Pressable style={[styles.primaryBtn, !canSubmit && styles.primaryBtnDisabled]} onPress={submit} disabled={!canSubmit}>
            <Text style={styles.primaryBtnText}>Submit</Text>
          </Pressable>
          <View style={styles.judgeRow}>
            <Pressable style={styles.ghostBtn} onPress={noSolution}>
              <Text style={styles.ghostBtnText}>No solution</Text>
            </Pressable>
            <Pressable style={styles.ghostBtn} onPress={pass}>
              <Text style={styles.ghostBtnText}>Pass</Text>
            </Pressable>
          </View>

          {feedback && (
            <View style={[styles.verdict, feedback.kind === "solved" ? styles.verdictOk : styles.verdictNo]}>
              <Text style={[styles.verdictBig, { color: feedback.kind === "solved" ? colors.verdictOkInk : colors.verdictNoInk }]}>
                {feedback.big}
              </Text>
              <Text style={[styles.verdictSub, { color: feedback.kind === "solved" ? colors.verdictOkInk : colors.verdictNoInk }]}>
                {feedback.sub}
              </Text>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

function VariantTab({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.variantTab, active && styles.variantTabActive]}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
    >
      <Text style={[styles.variantTabText, active && styles.variantTabTextActive]}>{label}</Text>
    </Pressable>
  );
}

function Stat({ label, value, emphasis }: { label: string; value: string; emphasis?: boolean }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, emphasis && styles.statValueEmphasis]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { paddingHorizontal: 18, paddingBottom: 40 },
  header: { paddingTop: 22, paddingBottom: 14, flexDirection: "row", alignItems: "baseline", justifyContent: "space-between" },
  wordmark: { fontFamily: fonts.serif, fontSize: 21, fontWeight: "700", color: colors.ink },
  wordmarkDot: { color: colors.accent },
  tagline: { fontFamily: fonts.serif, fontStyle: "italic", fontSize: 12, color: colors.inkFaint },
  variantbar: {
    flexDirection: "row",
    gap: 4,
    backgroundColor: colors.panel2,
    borderColor: colors.line,
    borderWidth: 1,
    borderRadius: 11,
    padding: 4,
    marginBottom: 18,
  },
  variantTab: { flex: 1, paddingVertical: 9, borderRadius: 8, alignItems: "center" },
  variantTabActive: { backgroundColor: colors.panel },
  variantTabText: { fontFamily: fonts.sans, fontSize: 14, fontWeight: "500", color: colors.inkDim },
  variantTabTextActive: { color: colors.accent, fontWeight: "600" },
  statsRow: { flexDirection: "row", gap: 8, marginBottom: 12 },
  stat: {
    flex: 1,
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingVertical: 10,
    alignItems: "center",
  },
  statLabel: { fontFamily: fonts.sans, fontSize: 10, letterSpacing: 1.2, color: colors.inkFaint },
  statValue: { fontFamily: fonts.serif, fontSize: 24, fontWeight: "700", color: colors.ink, marginTop: 2 },
  statValueEmphasis: { color: colors.accent },
  recordsRow: { alignItems: "center", marginBottom: 16 },
  recordsText: { fontFamily: fonts.sans, fontSize: 12, color: colors.inkFaint },
  targetReadout: { alignItems: "center", marginTop: 2, marginBottom: 16 },
  targetLabel: { fontFamily: fonts.sans, fontSize: 11, letterSpacing: 1.5, color: colors.inkFaint },
  targetNum: { fontFamily: fonts.serif, fontSize: 50, fontWeight: "700", color: colors.accent, marginTop: 4 },
  cardsLabel: { fontFamily: fonts.sans, fontSize: 11, letterSpacing: 1, color: colors.inkFaint, marginBottom: 8, marginHorizontal: 2 },
  label: { fontFamily: fonts.sans, fontSize: 11, letterSpacing: 1, color: colors.inkFaint, marginBottom: 8, marginHorizontal: 2, marginTop: space.xxl - 14 },
  exprLine: {
    minHeight: 56,
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingVertical: 14,
    paddingHorizontal: 14,
    marginBottom: 14,
    justifyContent: "center",
  },
  placeholder: { fontFamily: fonts.sans, fontSize: 14, color: colors.inkFaint },
  exprText: { fontFamily: fonts.mono, fontSize: 20, color: colors.ink, letterSpacing: 1 },
  primaryBtn: { backgroundColor: colors.accent, borderRadius: 11, paddingVertical: 15, alignItems: "center" },
  primaryBtnDisabled: { opacity: 0.35 },
  primaryBtnText: { fontFamily: fonts.serif, fontSize: 16, fontWeight: "700", color: colors.accentInk },
  judgeRow: { flexDirection: "row", gap: 9, marginTop: 9 },
  ghostBtn: { flex: 1, borderColor: colors.line2, borderWidth: 1, borderRadius: radius.md, paddingVertical: 12, alignItems: "center" },
  ghostBtnText: { fontFamily: fonts.sans, fontSize: 14, color: colors.inkDim },
  verdict: { marginTop: 20, padding: 16, borderRadius: 11, alignItems: "center", borderWidth: 1 },
  verdictOk: { backgroundColor: colors.verdictOkBg, borderColor: colors.good },
  verdictNo: { backgroundColor: colors.verdictNoBg, borderColor: colors.bad },
  verdictBig: { fontFamily: fonts.serif, fontSize: 18, fontWeight: "700", marginBottom: 3, textAlign: "center" },
  verdictSub: { fontFamily: fonts.mono, fontSize: 12, textAlign: "center" },
});
