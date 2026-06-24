import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { Variant } from "@twenty-something/core";
import { colors, fonts, radius, Tappable } from "@twenty-something/ui";

import { variantLabel } from "./format";

/** Hand-count choices for a practice session. */
const HAND_OPTIONS = [5, 10, 20];

interface Props {
  onStart: (variant: Variant, hands: number) => void;
  onBack: () => void;
}

/** Choose variant + number of hands, then start a bounded practice session. */
export function SetupScreen({ onStart, onBack }: Props) {
  const [variant, setVariant] = useState<Variant>("24");
  const [hands, setHands] = useState<number>(10);

  return (
    <SafeAreaView style={styles.safe}>
      <Tappable style={styles.back} onPress={onBack} hitSlop={12} accessibilityLabel="Back">
        <Text style={styles.backText}>‹ Back</Text>
      </Tappable>

      <Text style={styles.title}>New game</Text>

      <Text style={styles.label}>VARIANT</Text>
      <View style={styles.choiceRow}>
        {(["24", "20_something"] as Variant[]).map((v) => (
          <Tappable
            key={v}
            style={[styles.choice, variant === v && styles.choiceOn]}
            onPress={() => setVariant(v)}
            accessibilityState={{ selected: variant === v }}
          >
            <Text style={[styles.choiceText, variant === v && styles.choiceTextOn]}>{variantLabel(v)}</Text>
          </Tappable>
        ))}
      </View>

      <Text style={styles.label}>HANDS</Text>
      <View style={styles.choiceRow}>
        {HAND_OPTIONS.map((n) => (
          <Tappable
            key={n}
            style={[styles.choice, hands === n && styles.choiceOn]}
            onPress={() => setHands(n)}
            accessibilityState={{ selected: hands === n }}
          >
            <Text style={[styles.choiceText, hands === n && styles.choiceTextOn]}>{n}</Text>
          </Tappable>
        ))}
      </View>

      <View style={styles.spacer} />
      <Tappable style={styles.start} onPress={() => onStart(variant, hands)}>
        <Text style={styles.startText}>Start game</Text>
      </Tappable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: 24 },
  back: { paddingTop: 8, paddingBottom: 4 },
  backText: { fontFamily: fonts.sans, fontSize: 15, color: colors.inkDim },
  title: { fontFamily: fonts.serifBold, fontSize: 30, color: colors.ink, marginTop: 12, marginBottom: 28 },
  label: { fontFamily: fonts.sans, fontSize: 11, letterSpacing: 1.4, color: colors.inkFaint, marginBottom: 10, marginTop: 18 },
  choiceRow: { flexDirection: "row", gap: 10 },
  choice: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line2,
    backgroundColor: colors.panel,
    alignItems: "center",
  },
  choiceOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  choiceText: { fontFamily: fonts.serifSemibold, fontSize: 16, color: colors.ink },
  choiceTextOn: { color: colors.accentInk },
  spacer: { flex: 1 },
  start: { backgroundColor: colors.accent, paddingVertical: 17, borderRadius: radius.md, alignItems: "center", marginBottom: 48 },
  startText: { fontFamily: fonts.serifBold, fontSize: 18, color: colors.accentInk },
});
