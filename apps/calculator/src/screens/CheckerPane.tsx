import { StyleSheet, Text, View, Pressable } from "react-native";
import * as Haptics from "expo-haptics";
import {
  validateSolution,
  safeEvaluate,
  formatExpr,
  CLASSIC_OPERATIONS,
  type Hand,
  type Expr,
  type Operation,
} from "@twenty-something/core";

import { colors, fonts, radius, space } from "../theme/tokens";
import type { CheckerToken, CardToken, Verdict } from "../App";

interface Props {
  values: number[];
  hand: Hand;
  target: number;
  tokens: CheckerToken[];
  setTokens: (t: CheckerToken[]) => void;
  verdict: Verdict | null;
  setVerdict: (v: Verdict | null) => void;
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

/**
 * Shunting-yard parser: tokens → Expr tree, or null if malformed/incomplete.
 * This is checker-UI logic (the user builds an expression by tapping); the
 * resulting Expr is then handed to core's validateSolution for the verdict, so
 * the actual correctness judgment uses the same authority as the server.
 */
function parseTokens(tokens: CheckerToken[]): Expr | null {
  const out: Expr[] = [];
  const ops: string[] = [];
  const prec: Record<string, number> = { "+": 1, "-": 1, "×": 2, "÷": 2 };
  const pop = () => {
    const op = ops.pop() as Operation;
    const r = out.pop();
    const l = out.pop();
    if (!l || !r) throw new Error("bad");
    out.push({ kind: "node", op, left: l, right: r });
  };
  try {
    let prev: string | null = null;
    for (const t of tokens) {
      if (t.type === "card") {
        if (prev === "val" || prev === "rp") throw new Error("bad");
        out.push({ kind: "leaf", cardId: `c${t.i}`, value: 0 }); // value filled below
        prev = "val";
      } else if (t.type === "op") {
        if (prev !== "val" && prev !== "rp") throw new Error("bad");
        while (ops.length && ops[ops.length - 1] !== "(" && prec[ops[ops.length - 1]!]! >= prec[t.op]!) pop();
        ops.push(t.op);
        prev = "op";
      } else if (t.type === "lp") {
        if (prev === "val" || prev === "rp") throw new Error("bad");
        ops.push("(");
        prev = "lp";
      } else {
        while (ops.length && ops[ops.length - 1] !== "(") pop();
        if (ops[ops.length - 1] !== "(") throw new Error("bad");
        ops.pop();
        prev = "rp";
      }
    }
    while (ops.length) {
      if (ops[ops.length - 1] === "(") throw new Error("bad");
      pop();
    }
    if (out.length !== 1) return null;
    return out[0]!;
  } catch {
    return null;
  }
}

/** Fill leaf values from the real card values (parser used placeholders). */
function fillValues(expr: Expr, values: number[]): Expr {
  if (expr.kind === "leaf") {
    const i = Number(expr.cardId.slice(1));
    return { ...expr, value: values[i]! };
  }
  return {
    ...expr,
    left: fillValues(expr.left, values),
    right: fillValues(expr.right, values),
  };
}

const OPS: Operation[] = ["+", "-", "×", "÷"];

export function CheckerPane({ values, hand, target, tokens, setTokens, verdict, setVerdict }: Props) {
  const edit = (next: CheckerToken[]) => {
    setTokens(next);
    setVerdict(null); // editing invalidates any prior verdict
  };

  const push = (t: CheckerToken) => {
    Haptics.selectionAsync();
    edit([...tokens, t]);
  };
  const backspace = () => {
    Haptics.selectionAsync();
    edit(tokens.slice(0, -1));
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
      <View style={styles.keypad}>
        {OPS.map((op) => (
          <Pressable key={op} style={styles.key} onPress={() => push({ type: "op", op })}>
            <Text style={[styles.keyText, styles.keyOp]}>{op}</Text>
          </Pressable>
        ))}
        <Pressable style={styles.key} onPress={() => push({ type: "lp" })}>
          <Text style={styles.keyText}>(</Text>
        </Pressable>
        <Pressable style={styles.key} onPress={() => push({ type: "rp" })}>
          <Text style={styles.keyText}>)</Text>
        </Pressable>
        <Pressable style={styles.key} onPress={backspace} accessibilityLabel="Backspace">
          <Text style={styles.keyText}>⌫</Text>
        </Pressable>
      </View>

      <Pressable
        style={[styles.primaryBtn, !canCheck && styles.primaryBtnDisabled]}
        onPress={runCheck}
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
  keypad: { flexDirection: "row", flexWrap: "wrap", gap: 7, marginBottom: 14 },
  key: {
    width: "18%",
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderWidth: 1,
    borderRadius: 9,
    paddingVertical: 13,
    alignItems: "center",
  },
  keyText: { fontFamily: fonts.mono, fontSize: 17, fontWeight: "500", color: colors.ink },
  keyOp: { color: colors.accent, fontWeight: "600" },
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
