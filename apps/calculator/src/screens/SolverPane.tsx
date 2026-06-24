import { useState } from "react";
import { StyleSheet, Text, View, Pressable } from "react-native";
import * as Haptics from "expo-haptics";
import {
  findAllSolutions,
  formatExpr,
  CLASSIC_OPERATIONS,
  type Hand,
  type Solution,
} from "@twenty-something/core";

import { colors, fonts, radius, space } from "../theme/tokens";

interface Props {
  hand: Hand;
  target: number;
  onDealRandom: (values: number[], suits: number[]) => void;
}

export function SolverPane({ hand, target, onDealRandom }: Props) {
  const [solutions, setSolutions] = useState<Solution[] | null>(null);

  const runSolve = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const sols = findAllSolutions({ hand, target, operations: CLASSIC_OPERATIONS });
    // De-dupe by formatted string for a cleaner list.
    const byStr = new Map<string, Solution>();
    for (const s of sols) {
      const f = formatExpr(s.expr);
      if (!byStr.has(f)) byStr.set(f, s);
    }
    setSolutions([...byStr.values()]);
  };

  const dealRandom = () => {
    Haptics.selectionAsync();
    const v = Array.from({ length: 4 }, () => 1 + Math.floor(Math.random() * 13));
    const s = Array.from({ length: 4 }, () => Math.floor(Math.random() * 4));
    onDealRandom(v, s);
    setSolutions(null);
  };

  const shown = solutions?.slice(0, 8) ?? [];

  return (
    <View style={styles.pane}>
      <Pressable style={styles.primaryBtn} onPress={runSolve}>
        <Text style={styles.primaryBtnText}>Find solutions</Text>
      </Pressable>
      <Pressable style={styles.ghostBtn} onPress={dealRandom}>
        <Text style={styles.ghostBtnText}>Deal a random hand</Text>
      </Pressable>

      {solutions !== null && (
        <View style={styles.result}>
          {solutions.length === 0 ? (
            <View style={[styles.verdict, styles.verdictNo]}>
              <Text style={[styles.verdictBig, { color: colors.verdictNoInk }]}>No solution</Text>
              <Text style={[styles.verdictSub, { color: colors.verdictNoInk }]}>
                this hand can't make {target}
              </Text>
            </View>
          ) : (
            <>
              <Text style={styles.resultHead}>
                {solutions.length} solution{solutions.length > 1 ? "s" : ""} for {target}
                {solutions.length > 8 ? " · showing 8" : ""}
              </Text>
              {shown.map((s, idx) => (
                <View key={idx} style={styles.sol}>
                  <Text style={styles.solText}>
                    {formatExpr(s.expr)} = {target}
                  </Text>
                </View>
              ))}
            </>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  pane: { marginTop: space.xxl },
  primaryBtn: {
    backgroundColor: colors.accent,
    borderRadius: 11,
    paddingVertical: 15,
    alignItems: "center",
  },
  primaryBtnText: { fontFamily: fonts.serif, fontSize: 16, fontWeight: "700", color: colors.accentInk },
  ghostBtn: {
    marginTop: 9,
    borderColor: colors.line2,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingVertical: 12,
    alignItems: "center",
  },
  ghostBtnText: { fontFamily: fonts.sans, fontSize: 14, color: colors.inkDim },
  result: { marginTop: 22 },
  resultHead: { fontFamily: fonts.sans, fontSize: 13, color: colors.inkDim, marginBottom: 12 },
  sol: {
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderWidth: 1,
    borderLeftColor: colors.good,
    borderLeftWidth: 3,
    borderRadius: radius.sm,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 8,
  },
  solText: { fontFamily: fonts.mono, fontSize: 16, color: colors.ink },
  verdict: { marginTop: 4, padding: 16, borderRadius: 11, alignItems: "center", borderWidth: 1 },
  verdictNo: { backgroundColor: colors.verdictNoBg, borderColor: colors.bad },
  verdictBig: { fontFamily: fonts.serif, fontSize: 18, fontWeight: "700", marginBottom: 3 },
  verdictSub: { fontFamily: fonts.mono, fontSize: 12 },
});
