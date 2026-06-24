import { useEffect, useRef, useState } from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import type { Variant } from "@twenty-something/core";
import {
  CalcPad,
  colors,
  fonts,
  radius,
  parseTokens,
  fillValues,
  type CheckerToken,
  type CardToken,
  type CalcPadFeedback,
  type SuitData,
} from "@twenty-something/ui";

import {
  newGame,
  submitSolution,
  claimNoSolution,
  giveUp,
  currentHand,
  handsTotal,
  type AllStats,
  type GameState,
  type DealtHand,
} from "../logic";
import { formatClock, tokenStr, wrongFeedbackText } from "./format";

const SUITS: SuitData[] = [
  { s: "♠", red: false },
  { s: "♥", red: true },
  { s: "♦", red: true },
  { s: "♣", red: false },
];

interface Props {
  variant: Variant;
  hands: DealtHand[];
  initialStats: AllStats;
  mode: "practice" | "daily";
  /** Called once the bounded session is over, with the final engine state. */
  onDone: (finalState: GameState) => void;
  /** Quit back to home mid-game (no result recorded beyond what's already saved). */
  onQuit: () => void;
  /** Persist updated stats after each committed decision. */
  onStats: (stats: AllStats) => void;
  /** Local "YYYY-MM-DD" supplier for per-day stats bucketing. */
  dayKey: () => string;
  /** Clock supplier (ms). Injectable for tests; defaults to Date.now. */
  now?: () => number;
}

export function GameScreen({ variant, hands, initialStats, mode, onDone, onQuit, onStats, dayKey, now = Date.now }: Props) {
  const [game, setGame] = useState<GameState>(() => newGame(variant, hands, { now: now(), stats: initialStats }));
  const [tokens, setTokens] = useState<CheckerToken[]>([]);
  const [feedback, setFeedback] = useState<CalcPadFeedback | null>(null);
  const [tick, setTick] = useState<number>(() => now());

  // Live timer.
  useEffect(() => {
    const id = setInterval(() => setTick(now()), 250);
    return () => clearInterval(id);
  }, [now]);

  const hand = currentHand(game);
  const values = hand?.values ?? [];
  const total = handsTotal(game);
  const elapsedMs = Math.max(0, tick - game.handStartedAt);

  const usedIndices = tokens.filter((t): t is CardToken => t.type === "card").map((t) => t.i);
  const allFourUsed = usedIndices.length === 4 && [0, 1, 2, 3].every((i) => usedIndices.includes(i));
  const canSubmit = hand != null && parseTokens(tokens) !== null && allFourUsed;

  // Green/red top-bar flash on each committed decision.
  const flash = useRef(new Animated.Value(0)).current;
  const [flashKind, setFlashKind] = useState<"ok" | "bad">("ok");
  const pulse = (kind: "ok" | "bad") => {
    setFlashKind(kind);
    flash.setValue(1);
    Animated.timing(flash, { toValue: 0, duration: 650, useNativeDriver: false }).start();
  };

  const clearFeedback = () => setFeedback((f) => (f ? null : f));
  const push = (t: CheckerToken) => {
    setTokens((cur) => [...cur, t]);
    clearFeedback();
  };

  /** After a committed decision: persist, clear entry, and end the game if done. */
  const afterCommit = (next: GameState) => {
    setGame(next);
    setTokens([]);
    onStats(next.stats);
    if (next.done) setTimeout(() => onDone(next), 850);
  };

  const submit = () => {
    if (!hand) return;
    const tree = parseTokens(tokens);
    if (!tree) return;
    const expr = fillValues(tree, values);
    const out = submitSolution(game, expr, now(), dayKey());
    if (out.solved) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      pulse("ok");
      setFeedback({ kind: "ok", text: `solved in ${(out.elapsedMs / 1000).toFixed(1)}s · ★ ${out.stars.toFixed(1)}` });
      afterCommit(out.state);
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      setFeedback({ kind: "bad", text: wrongFeedbackText(out.error, expr, hand.target) });
    }
  };

  const noSolution = () => {
    if (!hand) return;
    const out = claimNoSolution(game, now(), dayKey());
    if (out.correct) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      pulse("ok");
      setFeedback({ kind: "ok", text: "correct — no solution exists" });
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      pulse("bad");
      setFeedback({ kind: "bad", text: out.reveal?.solution ? `it was solvable: ${out.reveal.solution}` : "it was solvable" });
    }
    afterCommit(out.state);
  };

  const pass = () => {
    if (!hand) return;
    const out = giveUp(game, now(), dayKey());
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    pulse("bad");
    setFeedback({
      kind: "bad",
      text: out.reveal?.solution ? `e.g. ${out.reveal.solution}` : "no solution existed",
    });
    afterCommit(out.state);
  };

  const barBg = flash.interpolate({
    inputRange: [0, 1],
    outputRange: [colors.panel, flashKind === "ok" ? colors.verdictOkBg : colors.verdictNoBg],
  });
  const barBorder = flash.interpolate({
    inputRange: [0, 1],
    outputRange: [colors.line, flashKind === "ok" ? colors.good : colors.bad],
  });

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.topRow}>
        <Pressable onPress={onQuit} hitSlop={10} accessibilityLabel="Quit to home">
          <Text style={styles.quit}>✕</Text>
        </Pressable>
        <Animated.View style={[styles.bar, { backgroundColor: barBg, borderColor: barBorder }]}>
          <View style={styles.barCell}>
            <Text style={styles.barLabel}>TIME</Text>
            <Text style={styles.barValue}>{formatClock(elapsedMs)}</Text>
          </View>
          <View style={styles.barDivider} />
          <View style={styles.barCell}>
            <Text style={styles.barLabel}>CORRECT</Text>
            <Text style={styles.barValue}>
              {game.session.correct}/{game.session.total}
            </Text>
          </View>
        </Animated.View>
      </View>

      <Text style={styles.progress}>
        {mode === "daily" ? "Daily · " : ""}Hand {Math.min(game.index + 1, total)} of {total}
      </Text>

      <View style={styles.pad}>
        {hand && (
          <CalcPad
            values={values}
            suits={hand.suits}
            suitData={SUITS}
            variant={variant}
            target={hand.target}
            expression={tokenStr(tokens, values)}
            usedIndices={usedIndices}
            canSubmit={canSubmit}
            dealNonce={game.index}
            onCardPress={(i) => {
              if (usedIndices.includes(i)) return;
              push({ type: "card", i });
            }}
            onOp={(op) => push({ type: "op", op })}
            onParen={(p) => push(p === "(" ? { type: "lp" } : { type: "rp" })}
            onBackspace={() => {
              setTokens((cur) => cur.slice(0, -1));
              clearFeedback();
            }}
            onClear={() => {
              setTokens([]);
              clearFeedback();
            }}
            onEquals={submit}
            onNoSolution={noSolution}
            onPass={pass}
            feedback={feedback}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: 18 },
  topRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingTop: 8 },
  quit: { fontFamily: fonts.sans, fontSize: 22, color: colors.inkFaint, paddingHorizontal: 2 },
  bar: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: radius.md,
    paddingVertical: 8,
  },
  barCell: { flex: 1, alignItems: "center" },
  barDivider: { width: 1, alignSelf: "stretch", backgroundColor: colors.line, marginVertical: 6 },
  barLabel: { fontFamily: fonts.sans, fontSize: 10, letterSpacing: 1.2, color: colors.inkFaint },
  barValue: { fontFamily: fonts.serif, fontSize: 22, fontWeight: "700", color: colors.ink, marginTop: 1 },
  progress: { fontFamily: fonts.sans, fontSize: 12, color: colors.inkFaint, textAlign: "center", marginTop: 12, marginBottom: 6 },
  pad: { flex: 1, justifyContent: "center" },
});
