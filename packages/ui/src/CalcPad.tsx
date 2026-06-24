import { useEffect, useRef } from "react";
import { Animated, Easing, Image, Pressable, StyleSheet, Text, View } from "react-native";
import * as Haptics from "expo-haptics";
import type { Operation, Variant } from "@twenty-something/core";

import { colors, fonts, radius } from "./theme/tokens";
import { CARD_BACK } from "./cards";
import { PlayingCard, CARD_ASPECT } from "./PlayingCard";

/** Cosmetic suit glyph + ink colour. Index into this with a card's suit index. */
export interface SuitData {
  s: string;
  red: boolean;
}

/** Parenthesis tokens the utility row can append. */
export type Paren = "(" | ")";

/** Inline detail line under the pad. The top-bar flash is the screen's job; this is the text. */
export interface CalcPadFeedback {
  kind: "ok" | "bad";
  text: string;
}

interface Props {
  /** Four card values, A–K = 1–13, in flip order (index 3 = the target/last card). */
  values: number[];
  /** Four suit indices 0–3 — purely cosmetic. */
  suits: number[];
  suitData: SuitData[];
  variant: Variant;
  /** The number to make — shown as the green pill in the expression row. */
  target: number;
  /** The live expression "display" string. Empty → placeholder. */
  expression: string;
  /** Card indices already placed in the expression (dimmed + un-tappable). */
  usedIndices: number[];
  /** Enables the `=` key (a full, parseable expression is built). */
  canSubmit: boolean;
  /** Bump on every fresh deal to retrigger the card-flip animation. */
  dealNonce: number;
  onCardPress: (i: number) => void;
  onOp: (op: Operation) => void;
  onParen: (p: Paren) => void;
  onBackspace: () => void;
  onClear: () => void;
  /** `=` — commit the expression for judging. */
  onEquals: () => void;
  onNoSolution: () => void;
  onPass: () => void;
  /** Optional inline detail line under the pad. */
  feedback?: CalcPadFeedback | null;
}

/** Top-to-bottom operator column, iOS-calculator order. */
const OPS: Operation[] = ["÷", "×", "-", "+"];

function pip(v: number): string {
  if (v === 1) return "A";
  if (v === 11) return "J";
  if (v === 12) return "Q";
  if (v === 13) return "K";
  return String(v);
}

/**
 * The calculator-style input pad: an expression "display" with the target as a
 * green pill, a 2×2 card grid that flips to reveal on each deal, a vertical
 * accent operator column ending in the big `=` key, a utility row
 * (backspace / clear / parens), and the No-solution / Pass judge buttons sitting
 * under the grid so `=` lands flush with them. Building keys (cards, operators,
 * parens, backspace, clear) fire a selection haptic; the commit keys (`=`,
 * No solution, Pass) leave their notification haptic to the screen.
 */
export function CalcPad({
  values,
  suits,
  suitData,
  variant,
  target,
  expression,
  usedIndices,
  canSubmit,
  dealNonce,
  onCardPress,
  onOp,
  onParen,
  onBackspace,
  onClear,
  onEquals,
  onNoSolution,
  onPass,
  feedback,
}: Props) {
  const tap = (fn: () => void) => () => {
    Haptics.selectionAsync();
    fn();
  };

  return (
    <View>
      {/* Expression "display" + the green target pill. */}
      <View style={styles.exprRow}>
        <Text
          style={expression.length === 0 ? styles.exprPlaceholder : styles.exprText}
          numberOfLines={1}
          ellipsizeMode="head"
        >
          {expression.length === 0 ? "tap cards & operators…" : expression}
        </Text>
        <View style={styles.targetPill} accessibilityLabel={`Make ${target}`}>
          <Text style={styles.targetPillText}>{target}</Text>
        </View>
      </View>

      {/* The calculator block: cards + judge row on the left, operator column on the right. */}
      <View style={styles.block}>
        <View style={styles.leftCol}>
          <View style={styles.grid}>
            {[0, 1, 2, 3].map((i) => {
              const suit = suitData[suits[i]!]!;
              return (
                <CardCell
                  key={i}
                  value={values[i]!}
                  suit={suit}
                  isTarget={variant === "20_something" && i === 3}
                  used={usedIndices.includes(i)}
                  index={i}
                  dealNonce={dealNonce}
                  onPress={() => {
                    Haptics.selectionAsync();
                    onCardPress(i);
                  }}
                />
              );
            })}
          </View>

          <View style={styles.judgeRow}>
            <Pressable style={styles.judgeBtn} onPress={onNoSolution}>
              <Text style={styles.judgeBtnText}>No solution</Text>
            </Pressable>
            <Pressable style={styles.judgeBtn} onPress={onPass}>
              <Text style={styles.judgeBtnText}>Pass</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.opCol}>
          <View style={styles.opStack}>
            {OPS.map((op) => (
              <Pressable key={op} style={styles.opKey} onPress={tap(() => onOp(op))}>
                <Text style={styles.opKeyText}>{op}</Text>
              </Pressable>
            ))}
          </View>
          <Pressable
            style={[styles.equals, !canSubmit && styles.equalsDisabled]}
            onPress={onEquals}
            disabled={!canSubmit}
            accessibilityRole="button"
            accessibilityLabel="Equals — submit"
          >
            <Text style={styles.equalsText}>=</Text>
          </Pressable>
        </View>
      </View>

      {/* Utility row: backspace · clear · ( · ) — iOS's ⌫ AC % shelf. */}
      <View style={styles.utilRow}>
        <Pressable style={styles.utilKey} onPress={tap(onBackspace)} accessibilityLabel="Backspace">
          <Text style={styles.utilKeyText}>⌫</Text>
        </Pressable>
        <Pressable style={styles.utilKey} onPress={tap(onClear)} accessibilityLabel="Clear">
          <Text style={styles.utilKeyText}>AC</Text>
        </Pressable>
        <Pressable style={styles.utilKey} onPress={tap(() => onParen("("))}>
          <Text style={styles.utilKeyText}>(</Text>
        </Pressable>
        <Pressable style={styles.utilKey} onPress={tap(() => onParen(")"))}>
          <Text style={styles.utilKeyText}>)</Text>
        </Pressable>
      </View>

      {feedback && (
        <Text style={[styles.feedback, feedback.kind === "ok" ? styles.feedbackOk : styles.feedbackBad]}>
          {feedback.text}
        </Text>
      )}
    </View>
  );
}

interface CardCellProps {
  value: number;
  suit: SuitData;
  isTarget: boolean;
  used: boolean;
  index: number;
  dealNonce: number;
  onPress: () => void;
}

/**
 * One card in the 2×2 grid. On each deal it flips from a felt-green back to its
 * face — a staggered rotateY using the built-in Animated API (no reanimated).
 * The two faces are stacked and back-face-hidden so only one shows at a time.
 */
function CardCell({ value, suit, isTarget, used, index, dealNonce, onPress }: CardCellProps) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    anim.setValue(0);
    Animated.timing(anim, {
      toValue: 1,
      duration: 360,
      delay: index * 90,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
    // Re-flip whenever a fresh hand is dealt.
  }, [dealNonce, anim, index]);

  const backRotate = anim.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "180deg"] });
  const faceRotate = anim.interpolate({ inputRange: [0, 1], outputRange: ["180deg", "360deg"] });

  return (
    <View style={styles.cardWrap}>
      {isTarget && <Text style={styles.targetMark}>TARGET CARD</Text>}
      <Pressable style={styles.cardAspect} onPress={onPress} disabled={used} accessibilityRole="button" accessibilityLabel={`Card ${index + 1}: ${pip(value)}${suit.s}`}>
        <Animated.View
          style={[styles.cardFace, { transform: [{ perspective: 800 }, { rotateY: backRotate }] }]}
          pointerEvents="none"
        >
          <Image source={CARD_BACK} style={styles.cardImg} resizeMode="contain" />
        </Animated.View>
        <Animated.View
          style={[styles.cardFace, { transform: [{ perspective: 800 }, { rotateY: faceRotate }] }]}
          pointerEvents="none"
        >
          <PlayingCard value={value} suitGlyph={suit.s} faded={used} style={styles.cardImg} />
        </Animated.View>
      </Pressable>
    </View>
  );
}

const OP_COL_WIDTH = 62;

const styles = StyleSheet.create({
  // --- Expression display ---------------------------------------------------
  exprRow: {
    minHeight: 56,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderWidth: 1,
    borderRadius: radius.lg,
    paddingVertical: 10,
    paddingLeft: 16,
    paddingRight: 10,
    marginBottom: 14,
  },
  exprText: { flex: 1, fontFamily: fonts.mono, fontSize: 22, color: colors.ink, letterSpacing: 1 },
  exprPlaceholder: { flex: 1, fontFamily: fonts.sans, fontSize: 14, color: colors.inkFaint },
  targetPill: {
    minWidth: 56,
    paddingHorizontal: 14,
    paddingVertical: 9,
    backgroundColor: colors.accent,
    borderRadius: radius.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  targetPillText: { fontFamily: fonts.serif, fontSize: 24, fontWeight: "700", color: colors.accentInk },

  // --- Calculator block -----------------------------------------------------
  block: { flexDirection: "row", alignItems: "stretch", gap: 10 },
  leftCol: { flex: 1 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  cardWrap: { width: "47.5%", alignItems: "center" },
  targetMark: {
    fontFamily: fonts.sans,
    fontSize: 9,
    fontWeight: "600",
    letterSpacing: 0.5,
    color: colors.accent,
    marginBottom: 2,
  },
  cardAspect: { width: "100%", aspectRatio: CARD_ASPECT },
  cardFace: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
    backfaceVisibility: "hidden",
  },
  cardImg: { width: "100%", height: "100%" },

  judgeRow: { flexDirection: "row", gap: 10, marginTop: 10 },
  judgeBtn: {
    flex: 1,
    height: 52,
    borderColor: colors.line2,
    borderWidth: 1,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  judgeBtnText: { fontFamily: fonts.sans, fontSize: 14, color: colors.inkDim },

  // --- Operator column ------------------------------------------------------
  opCol: { width: OP_COL_WIDTH },
  opStack: { flex: 1, gap: 10, marginBottom: 10 },
  opKey: {
    flex: 1,
    backgroundColor: colors.accent,
    borderRadius: OP_COL_WIDTH / 2,
    alignItems: "center",
    justifyContent: "center",
  },
  opKeyText: { fontFamily: fonts.serif, fontSize: 26, fontWeight: "700", color: colors.accentInk },
  equals: {
    height: 52,
    backgroundColor: colors.accentSoft,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  equalsDisabled: { opacity: 0.35 },
  equalsText: { fontFamily: fonts.serif, fontSize: 30, fontWeight: "700", color: colors.accentInk },

  // --- Utility row ----------------------------------------------------------
  utilRow: { flexDirection: "row", gap: 10, marginTop: 10 },
  utilKey: {
    flex: 1,
    backgroundColor: colors.panel2,
    borderColor: colors.line,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingVertical: 13,
    alignItems: "center",
  },
  utilKeyText: { fontFamily: fonts.mono, fontSize: 18, fontWeight: "500", color: colors.ink },

  // --- Inline feedback ------------------------------------------------------
  feedback: { fontFamily: fonts.mono, fontSize: 13, textAlign: "center", marginTop: 14 },
  feedbackOk: { color: colors.verdictOkInk },
  feedbackBad: { color: colors.verdictNoInk },
});
