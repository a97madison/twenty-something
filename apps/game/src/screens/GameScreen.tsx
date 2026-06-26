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
  type AllStats,
  type GameState,
  type DealtHand,
} from "../logic";
import { formatClock, tokenStr, wrongFeedbackText } from "./format";
import { WinFlourish } from "./WinFlourish";

const SUITS: SuitData[] = [
  { s: "♠", red: false },
  { s: "♥", red: true },
  { s: "♦", red: true },
  { s: "♣", red: false },
];

/** How long the result/reveal lingers before auto-advancing (tap skips it). */
const DWELL_OK_MS = 850;
const DWELL_BAD_MS = 2600;

/** A SOLVE worth this many stars (≈ solved in ≤16s) earns the win flourish. */
const FLOURISH_STARS = 4.5;

/** True when the next token must be an OPERAND (a card or "(") — start of the
 * expression, or right after an operator or an opening paren. */
function expectsOperand(tokens: CheckerToken[]): boolean {
  const last = tokens[tokens.length - 1];
  return !last || last.type === "op" || last.type === "lp";
}

/** Net unmatched "(" so far. */
function openParens(tokens: CheckerToken[]): number {
  let d = 0;
  for (const t of tokens) {
    if (t.type === "lp") d++;
    else if (t.type === "rp") d--;
  }
  return d;
}

/**
 * A committed decision held on screen so the player can read the result (and any
 * revealed answer) before the next hand deals. `shownMs` freezes the timer at the
 * solve time; `next` is the already-advanced engine state, applied on continue.
 */
interface Pending {
  next: GameState;
  shownMs: number;
  dwell: number;
}

interface Props {
  variant: Variant;
  hands: DealtHand[];
  initialStats: AllStats;
  mode: "practice" | "daily" | "challenge";
  /** When false, suppress all haptic feedback (Settings toggle). */
  haptics?: boolean;
  /** Called once the bounded session is over, with the final engine state. */
  onDone: (finalState: GameState) => void;
  /** Persist updated stats after each committed decision. */
  onStats: (stats: AllStats) => void;
  /** Local "YYYY-MM-DD" supplier for per-day stats bucketing. */
  dayKey: () => string;
  /** Clock supplier (ms). Injectable for tests; defaults to Date.now. */
  now?: () => number;
}

export function GameScreen({ variant, hands, initialStats, haptics = true, onDone, onStats, dayKey, now = Date.now }: Props) {
  // Haptic helpers honoring the Settings toggle.
  const buzzOk = () => haptics && Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  const buzzBad = () => haptics && Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
  const buzzWarn = () => haptics && Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
  const buzzWin = () => haptics && Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
  const [game, setGame] = useState<GameState>(() => newGame(variant, hands, { now: now(), stats: initialStats }));
  const [tokens, setTokens] = useState<CheckerToken[]>([]);
  const [feedback, setFeedback] = useState<CalcPadFeedback | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);
  const [tick, setTick] = useState<number>(() => now());
  // A fast, near-perfect solve fires a one-shot celebration overlay; the nonce
  // re-mounts it so each great solve replays from the start.
  const [celebrate, setCelebrate] = useState(false);
  const flourishNonce = useRef(0);

  // Live timer — paused while a result is held on screen.
  useEffect(() => {
    if (pending) return;
    const id = setInterval(() => setTick(now()), 250);
    return () => clearInterval(id);
  }, [now, pending]);

  const hand = currentHand(game);
  const values = hand?.values ?? [];
  // While a result is held, freeze the clock and show the just-decided tallies.
  const view = pending ? pending.next : game;
  const elapsedMs = pending ? pending.shownMs : Math.max(0, tick - game.handStartedAt);

  const usedIndices = tokens.filter((t): t is CardToken => t.type === "card").map((t) => t.i);
  const allFourUsed = usedIndices.length === 4 && [0, 1, 2, 3].every((i) => usedIndices.includes(i));
  const canSubmit = !pending && hand != null && parseTokens(tokens) !== null && allFourUsed;

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

  /** Hold a committed decision on screen; persist now, advance on continue. */
  const settle = (next: GameState, kind: "ok" | "bad") => {
    onStats(next.stats);
    setPending({ next, shownMs: Math.max(0, now() - game.handStartedAt), dwell: kind === "ok" ? DWELL_OK_MS : DWELL_BAD_MS });
  };

  /** Leave the held result: deal the next hand, or end the session. */
  const advance = () => {
    if (!pending) return;
    const { next } = pending;
    setPending(null);
    setFeedback(null);
    setCelebrate(false);
    setTokens([]);
    if (next.done) onDone(next);
    else setGame({ ...next, handStartedAt: now() }); // restart the clock for the fresh hand
  };

  // Auto-advance after the dwell; a tap on the overlay skips it.
  useEffect(() => {
    if (!pending) return;
    const id = setTimeout(advance, pending.dwell);
    return () => clearTimeout(id);
  }, [pending]);

  const submit = () => {
    if (pending || !hand) return;
    const tree = parseTokens(tokens);
    if (!tree) return;
    const expr = fillValues(tree, values);
    const out = submitSolution(game, expr, now(), dayKey());
    if (out.solved) {
      pulse("ok");
      setFeedback({ kind: "ok", text: `solved in ${(out.elapsedMs / 1000).toFixed(1)}s · ★ ${out.stars.toFixed(1)}` });
      if (out.stars >= FLOURISH_STARS) {
        // Fast, near-perfect solve: extra haptic punch + the celebration overlay.
        flourishNonce.current += 1;
        setCelebrate(true);
        buzzWin();
      } else {
        buzzOk();
      }
      settle(out.state, "ok");
    } else {
      buzzWarn();
      pulse("bad");
      setFeedback({ kind: "bad", text: wrongFeedbackText(out.error, expr, hand.target) });
    }
  };

  const noSolution = () => {
    if (pending || !hand) return;
    const out = claimNoSolution(game, now(), dayKey());
    if (out.correct) {
      buzzOk();
      pulse("ok");
      setFeedback({ kind: "ok", text: "correct — no solution exists" });
      settle(out.state, "ok");
    } else {
      buzzBad();
      pulse("bad");
      setFeedback({ kind: "bad", text: out.reveal?.solution ? `it was solvable: ${out.reveal.solution}` : "it was solvable" });
      settle(out.state, "bad");
    }
  };

  const pass = () => {
    if (pending || !hand) return;
    const out = giveUp(game, now(), dayKey());
    buzzBad();
    pulse("bad");
    setFeedback({
      kind: "bad",
      text: out.reveal?.solution ? `e.g. ${out.reveal.solution}` : "no solution existed",
    });
    settle(out.state, "bad");
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
        <Animated.View style={[styles.bar, { backgroundColor: barBg, borderColor: barBorder }]}>
          <View style={styles.barCell}>
            <Text style={styles.barLabel}>TIME</Text>
            <Text style={styles.barValue}>{formatClock(elapsedMs)}</Text>
          </View>
          <View style={styles.barDivider} />
          <View style={styles.barCell}>
            <Text style={styles.barLabel}>HAND</Text>
            <Text style={styles.barValue}>
              {Math.min(view.index + (pending ? 0 : 1), view.hands.length)}/{view.hands.length}
            </Text>
          </View>
          <View style={styles.barDivider} />
          <View style={styles.barCell}>
            <Text style={styles.barLabel}>STREAK</Text>
            <Text style={[styles.barValue, view.streak >= 2 && styles.streakHot]}>{view.streak}</Text>
          </View>
        </Animated.View>
      </View>

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
              // Only feasible next inputs register (the keys aren't disabled).
              if (pending || usedIndices.includes(i) || !expectsOperand(tokens)) return;
              push({ type: "card", i });
            }}
            onOp={(op) => {
              if (pending || expectsOperand(tokens)) return; // need a preceding operand
              push({ type: "op", op });
            }}
            onParen={(p) => {
              if (pending) return;
              if (p === "(") {
                if (!expectsOperand(tokens)) return;
                push({ type: "lp" });
              } else {
                if (expectsOperand(tokens) || openParens(tokens) <= 0) return;
                push({ type: "rp" });
              }
            }}
            onBackspace={() => {
              if (pending) return;
              setTokens((cur) => cur.slice(0, -1));
              clearFeedback();
            }}
            onEquals={submit}
            onNoSolution={noSolution}
            onPass={pass}
            feedback={feedback}
            haptics={haptics}
          />
        )}

        {/* Result curtain: a transparent tap-anywhere layer that holds the hand on
            screen so the verdict (and any revealed answer) is readable, then deals. */}
        {pending && (
          <Pressable style={styles.curtain} onPress={advance} accessibilityLabel="Continue">
            <Text style={styles.curtainHint}>{pending.next.done ? "tap to see results" : "tap to continue"}</Text>
          </Pressable>
        )}

        {/* Celebration for a fast solve — over the curtain, but pointer-events
            off so the tap-to-continue underneath still works. */}
        {celebrate && <WinFlourish key={flourishNonce.current} />}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: 18 },
  topRow: { flexDirection: "row", alignItems: "center", paddingTop: 8 },
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
  barValue: { fontFamily: fonts.serifBold, fontSize: 22, color: colors.ink, marginTop: 1 },
  streakHot: { color: colors.accent },
  pad: { flex: 1, marginTop: 14 },
  curtain: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "flex-end", paddingBottom: 6 },
  curtainHint: { fontFamily: fonts.sans, fontSize: 12, letterSpacing: 0.6, color: colors.inkFaint },
});
