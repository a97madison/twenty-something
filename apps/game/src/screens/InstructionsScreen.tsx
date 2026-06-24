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
          Four cards are dealt. Combine all four — using <Em>+ − × ÷</Em> and parentheses, each card exactly
          once — to hit the target shown in the green pill.
        </Para>

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
          <Para>
            Hands are dealt naturally, so some have no solution at all. Your job is to <Em>judge</Em> each hand:
          </Para>
          <Bullet>Build an expression and press <Em>=</Em> to commit it.</Bullet>
          <Bullet><Em>No solution</Em> — claim the hand can't be made. Right only if it truly can't.</Bullet>
          <Bullet><Em>Pass</Em> — give up; the answer is revealed and your streak breaks.</Bullet>
        </Section>

        <Section title="Your rating">
          <Para>
            Every hand earns up to <Em>★ 5</Em>: half for being right, half for being fast. Your rating is the
            average over all your hands — tracked separately for each variant, all-time and this week.
          </Para>
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
  title: { fontFamily: fonts.serif, fontSize: 30, fontWeight: "700", color: colors.ink, marginTop: 8, marginBottom: 18 },
  section: { marginTop: 22 },
  sectionTitle: { fontFamily: fonts.serif, fontSize: 18, fontWeight: "700", color: colors.accent, marginBottom: 8 },
  para: { fontFamily: fonts.sans, fontSize: 15, lineHeight: 23, color: colors.inkDim, marginBottom: 8 },
  bulletRow: { flexDirection: "row", gap: 8, marginBottom: 6 },
  bulletDot: { fontFamily: fonts.sans, fontSize: 15, color: colors.accent, lineHeight: 23 },
  bulletText: { flex: 1, fontFamily: fonts.sans, fontSize: 15, lineHeight: 23, color: colors.inkDim },
  em: { color: colors.ink, fontWeight: "600" },
});
