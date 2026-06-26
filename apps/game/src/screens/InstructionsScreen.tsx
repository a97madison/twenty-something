import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, fonts, radius, Tappable } from "@twenty-something/ui";

interface Props {
  onBack: () => void;
}

/** Simple, elegant how-to-play page. Back button top-left. */
export function InstructionsScreen({ onBack }: Props) {
  return (
    <SafeAreaView style={styles.safe}>
      <Tappable style={styles.back} onPress={onBack} hitSlop={12} accessibilityLabel="Back">
        <Text style={styles.backText}>‹ Back</Text>
      </Tappable>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>How to play</Text>

        <Para>
          Four cards are dealt. Use each card exactly once to solve for the target number.
        </Para>

        <View style={styles.example}>
          <Text style={styles.exampleLabel}>EXAMPLE</Text>
          <Text style={styles.exampleCards}>7   3   8   2</Text>
          <Text style={styles.exampleTarget}>make 24</Text>
        </View>

        <Section title="The two variants">
          <Para>
            <Em>24</Em> — always make 24.
          </Para>
          <Para>
            <Em>20-Something</Em> — the target is 18 plus the value of the last card (the one marked{" "}
            <Em>TARGET CARD</Em>). A Jack there means 18 + 11 = 29.
          </Para>
        </Section>

        <Section title="But it might be impossible">
          <Para>Some hands have no solution, you can:</Para>
          <Bullet>Build an expression and press <Em>=</Em> to commit it.</Bullet>
          <Bullet><Em>No solution</Em> — claim the hand can't be made. Right only if it truly can't.</Bullet>
          <Bullet><Em>Pass</Em> — give up; your streak breaks.</Bullet>
        </Section>
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function Para({ children }: { children: React.ReactNode }) {
  return <Text style={styles.para}>{children}</Text>;
}

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <View style={styles.bulletRow}>
      <Text style={styles.bulletDot}>•</Text>
      <Text style={styles.bulletText}>{children}</Text>
    </View>
  );
}

function Em({ children }: { children: React.ReactNode }) {
  return <Text style={styles.em}>{children}</Text>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  back: { paddingTop: 8, paddingBottom: 4, paddingHorizontal: 24 },
  backText: { fontFamily: fonts.sans, fontSize: 15, color: colors.inkDim },
  scroll: { paddingHorizontal: 24, paddingBottom: 48 },
  title: { fontFamily: fonts.serifBold, fontSize: 30, color: colors.ink, marginTop: 8, marginBottom: 18 },
  section: { marginTop: 22 },
  sectionTitle: { fontFamily: fonts.serifBold, fontSize: 18, color: colors.accent, marginBottom: 8 },
  para: { fontFamily: fonts.sans, fontSize: 15, lineHeight: 23, color: colors.inkDim, marginBottom: 8 },
  bulletRow: { flexDirection: "row", gap: 8, marginBottom: 6 },
  bulletDot: { fontFamily: fonts.sans, fontSize: 15, color: colors.accent, lineHeight: 23 },
  bulletText: { flex: 1, fontFamily: fonts.sans, fontSize: 15, lineHeight: 23, color: colors.inkDim },
  em: { color: colors.ink, fontWeight: "600" },
  example: {
    marginTop: 14,
    paddingVertical: 16,
    borderRadius: radius.md,
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.line2,
    alignItems: "center",
    gap: 6,
  },
  exampleLabel: { fontFamily: fonts.sans, fontSize: 11, letterSpacing: 1.4, color: colors.inkFaint },
  exampleCards: { fontFamily: fonts.serifBold, fontSize: 28, letterSpacing: 4, color: colors.ink },
  exampleTarget: { fontFamily: fonts.mono, fontSize: 15, color: colors.accent },
});
