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
  submitSolution,
  passHand,
  loadRecords,
  saveRecords,
  type GameState,
  type Records,
} from "./logic";
import { storage } from "./storage";

const SUITS = [
  { s: "♠", red: false },
  { s: "♥", red: true },
  { s: "♦", red: true },
  { s: "♣", red: false },
];

type Feedback = { kind: "solved" | "wrong"; big: string; sub: string };

function pip(v: number): string {
  if (v === 1) return "A";
  if (v === 11) return "J";
  if (v === 12) return "Q";
  if (v === 13) return "K";
  return String(v);
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

/** Take the better of two record sets (highest streak, fastest time). */
function bestOf(a: Records, b: Records): Records {
  return {
    bestStreak: Math.max(a.bestStreak, b.bestStreak),
    bestTimeMs:
      a.bestTimeMs === null
        ? b.bestTimeMs
        : b.bestTimeMs === null
          ? a.bestTimeMs
          : Math.min(a.bestTimeMs, b.bestTimeMs),
  };
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

export default function App() {
  const [game, setGame] = useState<GameState>(() =>
    newGame("24", { now: Date.now(), records: { bestStreak: 0, bestTimeMs: null } }),
  );
  const [tokens, setTokens] = useState<CheckerToken[]>([]);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [tick, setTick] = useState<number>(() => Date.now());

  // Load saved records once on mount and fold them in (the run started with
  // empty records; whatever's on disk is at least as good).
  useEffect(() => {
    let alive = true;
    loadRecords(storage).then((recs) => {
      if (alive) setGame((g) => ({ ...g, records: bestOf(g.records, recs) }));
    });
    return () => {
      alive = false;
    };
  }, []);

  // Drive the live timer. The timer is a scoring input, never a fail clock.
  useEffect(() => {
    const id = setInterval(() => setTick(Date.now()), 250);
    return () => clearInterval(id);
  }, []);

  const { variant, current, streak, score, records } = game;
  const values = current.values;
  const elapsedMs = Math.max(0, tick - game.handStartedAt);

  const usedIndices = tokens.filter((t) => t.type === "card").map((t) => (t as CardToken).i);
  const allFourUsed = [0, 1, 2, 3].every((i) => usedIndices.includes(i)) && usedIndices.length === 4;
  const canSubmit = parseTokens(tokens) !== null && allFourUsed;

  const clearFeedback = () => {
    if (feedback) setFeedback(null);
  };

  const addCard = (i: number) => {
    if (usedIndices.includes(i)) return;
    Haptics.selectionAsync();
    setTokens([...tokens, { type: "card", i }]);
    clearFeedback();
  };

  const submit = () => {
    const tree = parseTokens(tokens);
    if (!tree) return;
    const expr = fillValues(tree, values);
    const out = submitSolution(game, expr, Date.now());
    if (out.solved) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setGame(out.state);
      setTokens([]);
      setFeedback({ kind: "solved", big: `Solved in ${formatSolve(out.elapsedMs)}`, sub: `+${out.gained}  ·  streak ${out.state.streak}` });
      saveRecords(storage, out.state.records).catch(() => {});
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      setFeedback(wrongFeedback(out.error, expr, current.target));
    }
  };

  const pass = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    setGame(passHand(game, Date.now()));
    setTokens([]);
    setFeedback(null);
  };

  const changeVariant = (v: Variant) => {
    if (v === variant) return;
    Haptics.selectionAsync();
    setGame(newGame(v, { now: Date.now(), records }));
    setTokens([]);
    setFeedback(null);
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
            <Stat label="SCORE" value={String(score)} />
          </View>

          <View style={styles.recordsRow}>
            <Text style={styles.recordsText}>
              best streak {records.bestStreak}
              {"   ·   "}
              best time {records.bestTimeMs === null ? "—" : formatSolve(records.bestTimeMs)}
            </Text>
          </View>

          <View style={styles.targetReadout}>
            <Text style={styles.targetLabel}>MAKE</Text>
            <Text style={styles.targetNum}>{current.target}</Text>
          </View>

          <Text style={styles.cardsLabel}>Tap a card to add it to your expression</Text>
          <CardRow
            values={values}
            suits={current.suits}
            suitData={SUITS}
            variant={variant}
            mode="checker"
            usedIndices={usedIndices}
            onCardPress={addCard}
          />

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
          <Pressable style={styles.ghostBtn} onPress={pass}>
            <Text style={styles.ghostBtnText}>Pass — breaks your streak</Text>
          </Pressable>

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
  ghostBtn: { marginTop: 9, borderColor: colors.line2, borderWidth: 1, borderRadius: radius.md, paddingVertical: 12, alignItems: "center" },
  ghostBtnText: { fontFamily: fonts.sans, fontSize: 14, color: colors.inkDim },
  verdict: { marginTop: 20, padding: 16, borderRadius: 11, alignItems: "center", borderWidth: 1 },
  verdictOk: { backgroundColor: colors.verdictOkBg, borderColor: colors.good },
  verdictNo: { backgroundColor: colors.verdictNoBg, borderColor: colors.bad },
  verdictBig: { fontFamily: fonts.serif, fontSize: 18, fontWeight: "700", marginBottom: 3, textAlign: "center" },
  verdictSub: { fontFamily: fonts.mono, fontSize: 12, textAlign: "center" },
});
