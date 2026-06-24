import { StyleSheet, Text, View, Pressable } from "react-native";
import * as Haptics from "expo-haptics";
import {
  validateSolution,
  safeEvaluate,
  formatExpr,
  CLASSIC_OPERATIONS,
  type Hand,
} from "@twenty-something/core";

import { colors, fonts, radius, space, Keypad, parseTokens, fillValues } from "@twenty-something/ui";
import type { CheckerToken, CardToken } from "@twenty-something/ui";
import type { Verdict } from "../App";

interface Props {
  values: number[];
  hand: Hand;
  target: number;
  tokens: CheckerToken[];
  setTokens: (t: CheckerToken[]) => void;
  verdict: Verdict | null;
  setVerdict: (v: Verdict | null) => void;
  onChecked: () => void;
}

function pip(v: number): string {
  if (v === 1) return "A";
  if (v === 11) return "J";
  if (v === 12) return "Q";
  if (v === 13) return "K";
  return String(v);
}

/** Render the token sequence as a readable string for the expression line. */
function tokenStr(tokens: CheckerToken[], values: number[]): string {
  return tokens
    .map((t) => {
      if (t.type === "card") return pip(values[t.i]!);
      if (t.type === "op") return ` ${t.op} `;
      return t.type === "lp" ? "(" : ")";
    })
    .join("");
}

export function CheckerPane({ values, hand, target, tokens, setTokens, verdict, setVerdict, onChecked }: Props) {
  const edit = (next: CheckerToken[]) => {
    setTokens(next);
    setVerdict(null); // editing invalidates any prior verdict
  };

  const allFourUsed =
    [0, 1, 2, 3].every((i) => tokens.some((t) => t.type === "card" && (t as CardToken).i === i)) &&
    tokens.filter((t) => t.type === "card").length === 4;
  const parsed = parseTokens(tokens);
  const canCheck = parsed !== null && allFourUsed;

  const runCheck = () => {
    const tree = parseTokens(tokens);
    if (!tree) {
      setVerdict({ ok: false, big: "Not a complete expression", sub: "finish the expression first" });
      return;
    }
    const expr = fillValues(tree, values);
    const result = validateSolution(expr, { hand, target, operations: CLASSIC_OPERATIONS });
    if (result.valid) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setVerdict({ ok: true, big: `Correct — that makes ${target}`, sub: `${formatExpr(expr)} = ${target}` });
    } else if (result.error === "wrong_cards") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setVerdict({ ok: false, big: "Use each card once", sub: "all four cards, no repeats" });
    } else if (result.error === "illegal_arithmetic") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setVerdict({ ok: false, big: "Illegal arithmetic", sub: "division by zero" });
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      const v = safeEvaluate(expr);
      const shown = v === null ? "—" : Number.isInteger(v) ? String(v) : v.toFixed(2);
      setVerdict({ ok: false, big: `That makes ${shown}, not ${target}`, sub: "keep trying" });
    }
  };

  const clear = () => {
    Haptics.selectionAsync();
    edit([]);
  };

  return (
    <View style={styles.pane}>
      <Text style={styles.label}>Your expression</Text>
      <View style={styles.exprLine}>
        {tokens.length === 0 ? (
          <Text style={styles.placeholder}>tap cards and operators below…</Text>
        ) : (
          <Text style={styles.exprText}>{tokenStr(tokens, values)}</Text>
        )}
      </View>

      <Text style={styles.label}>Operators</Text>
      <Keypad
        onPush={(t) => edit([...tokens, t])}
        onBackspace={() => edit(tokens.slice(0, -1))}
      />

      <Pressable
        style={[styles.primaryBtn, !canCheck && styles.primaryBtnDisabled]}
        onPress={() => {
          runCheck();
          onChecked();
        }}
        disabled={!canCheck}
      >
        <Text style={styles.primaryBtnText}>Check answer</Text>
      </Pressable>
      <Pressable style={styles.ghostBtn} onPress={clear}>
        <Text style={styles.ghostBtnText}>Clear</Text>
      </Pressable>

      {verdict && (
        <View style={[styles.verdict, verdict.ok ? styles.verdictOk : styles.verdictNo]}>
          <Text style={[styles.verdictBig, { color: verdict.ok ? colors.verdictOkInk : colors.verdictNoInk }]}>
            {verdict.big}
          </Text>
          <Text style={[styles.verdictSub, { color: verdict.ok ? colors.verdictOkInk : colors.verdictNoInk }]}>
            {verdict.sub}
          </Text>
        </View>
      )}

      <Text style={styles.hint}>
        In the game you race to do this from memory.{"\n"}
        Build a solution using each of the four cards exactly once to practice!
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pane: { marginTop: space.xxl },
  label: { fontFamily: fonts.sans, fontSize: 11, letterSpacing: 1, color: colors.inkFaint, marginBottom: 8, marginHorizontal: 2 },
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
  hint: { fontFamily: fonts.sans, fontSize: 12, color: colors.inkFaint, textAlign: "center", marginTop: 14, lineHeight: 18 },
});
