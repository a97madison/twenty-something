import { StyleSheet, Text, View, Pressable } from "react-native";
import type { Variant } from "@twenty-something/core";
import { colors, fonts, radius } from "../theme/tokens";

type SuitData = { s: string; red: boolean };

interface Props {
  values: number[];
  suits: number[];
  suitData: SuitData[];
  variant: Variant;
  mode: "solver" | "checker";
  usedIndices: number[];
  onCardPress: (i: number) => void;
}

function pip(v: number): string {
  if (v === 1) return "A";
  if (v === 11) return "J";
  if (v === 12) return "Q";
  if (v === 13) return "K";
  return String(v);
}

export function CardRow({ values, suits, suitData, variant, mode, usedIndices, onCardPress }: Props) {
  return (
    <View style={styles.row}>
      {values.map((v, i) => {
        const suit = suitData[suits[i]!]!;
        const isFourth = variant === "20_something" && i === 3;
        const used = mode === "checker" && usedIndices.includes(i);
        const inkColor = suit.red ? colors.cardRed : colors.cardBlack;
        return (
          <View key={i} style={styles.cardWrap}>
            {isFourth && <Text style={styles.fourthMark}>TARGET CARD</Text>}
            <Pressable
              onPress={() => onCardPress(i)}
              disabled={used}
              style={[
                styles.card,
                isFourth && styles.cardFourth,
                used && styles.cardUsed,
              ]}
              accessibilityRole="button"
              accessibilityLabel={`Card ${i + 1}: ${pip(v)}${suit.s}`}
            >
              <Text style={[styles.cornerTL, { color: inkColor }]}>
                {pip(v)}
                {suit.s}
              </Text>
              <Text style={[styles.pip, { color: inkColor }]}>{pip(v)}</Text>
              <Text style={[styles.cornerBR, { color: inkColor }]}>
                {pip(v)}
                {suit.s}
              </Text>
            </Pressable>
            <Text style={styles.idx}>card {i + 1}</Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: 9, marginBottom: 6 },
  cardWrap: { flex: 1, alignItems: "center" },
  fourthMark: {
    fontFamily: fonts.sans,
    fontSize: 9,
    fontWeight: "600",
    letterSpacing: 0.5,
    color: colors.accent,
    marginBottom: 2,
    textAlign: "center",
  },
  card: {
    width: "100%",
    aspectRatio: 2.5 / 3.5,
    backgroundColor: colors.cardFace,
    borderRadius: radius.md,
    borderColor: colors.line,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  cardFourth: { borderColor: colors.accentSoft },
  cardUsed: { opacity: 0.4 },
  pip: { fontFamily: fonts.serif, fontSize: 28, fontWeight: "700" },
  cornerTL: { position: "absolute", top: 5, left: 7, fontFamily: fonts.serif, fontSize: 12, fontWeight: "700" },
  cornerBR: {
    position: "absolute",
    bottom: 5,
    right: 7,
    fontFamily: fonts.serif,
    fontSize: 12,
    fontWeight: "700",
    transform: [{ rotate: "180deg" }],
  },
  idx: { fontFamily: fonts.sans, fontSize: 10, color: colors.inkFaint, marginTop: 4 },
});
