import { Alert, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, fonts, radius, shadows, Tappable } from "@twenty-something/ui";

import type { Prefs } from "../logic";

/** Shown in the footer + the about line. Bump alongside app.json. */
const APP_VERSION = "1.0.0";

interface Props {
  prefs: Prefs;
  onChange: (prefs: Prefs) => void;
  onDeleteData: () => void;
  onPrivacy: () => void;
  onBack: () => void;
}

/** Preferences: feedback toggles, notification categories, and data controls. */
export function SettingsScreen({ prefs, onChange, onDeleteData, onPrivacy, onBack }: Props) {
  const set = (patch: Partial<Prefs>) => onChange({ ...prefs, ...patch });

  const confirmDelete = () => {
    Alert.alert(
      "Delete all data?",
      "This erases your stats, streak, freezes, and rival records on this device. It can't be undone.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Delete everything", style: "destructive", onPress: onDeleteData },
      ],
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      <Tappable style={styles.back} onPress={onBack} hitSlop={12} accessibilityLabel="Back">
        <Text style={styles.backText}>‹ Back</Text>
      </Tappable>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>Settings</Text>

        <Text style={styles.section}>FEEDBACK</Text>
        <View style={styles.card}>
          <Row label="Haptics" sub="Taps and verdicts buzz" value={prefs.haptics} onValueChange={(v) => set({ haptics: v })} />
          <View style={styles.hr} />
          <Row label="Sound" sub="Coming with the next update" value={prefs.sound} onValueChange={(v) => set({ sound: v })} />
        </View>

        <Text style={styles.section}>NOTIFICATIONS</Text>
        <View style={styles.card}>
          <Row label="Daily reminder" sub="A nudge when a fresh hand is dealt" value={prefs.notifyDaily} onValueChange={(v) => set({ notifyDaily: v })} />
          <View style={styles.hr} />
          <Row label="Streak alerts" sub="Before a live streak lapses" value={prefs.notifyStreak} onValueChange={(v) => set({ notifyStreak: v })} />
          <View style={styles.hr} />
          <Row label="Weekly recap" sub="Your week, when the season resets" value={prefs.notifyWeekly} onValueChange={(v) => set({ notifyWeekly: v })} />
        </View>
        <Text style={styles.note}>Notifications start delivering in an upcoming build; your choices are saved.</Text>

        <Text style={styles.section}>DATA & PRIVACY</Text>
        <View style={styles.card}>
          <Tappable style={styles.linkRow} onPress={onPrivacy} accessibilityRole="button">
            <Text style={styles.linkText}>Privacy policy</Text>
            <Text style={styles.chevron}>›</Text>
          </Tappable>
          <View style={styles.hr} />
          <Tappable style={styles.linkRow} onPress={confirmDelete} accessibilityRole="button">
            <Text style={[styles.linkText, styles.danger]}>Delete all my data</Text>
          </Tappable>
        </View>

        <Text style={styles.footer}>20·Something · v{APP_VERSION}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function Row({ label, sub, value, onValueChange }: { label: string; sub: string; value: boolean; onValueChange: (v: boolean) => void }) {
  return (
    <View style={styles.row}>
      <View style={styles.rowText}>
        <Text style={styles.rowLabel}>{label}</Text>
        <Text style={styles.rowSub}>{sub}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: colors.line2, true: colors.accent }}
        thumbColor={colors.panel}
        ios_backgroundColor={colors.line2}
        accessibilityLabel={label}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  back: { paddingTop: 8, paddingBottom: 4, paddingHorizontal: 24 },
  backText: { fontFamily: fonts.sans, fontSize: 15, color: colors.inkDim },
  scroll: { paddingHorizontal: 24, paddingBottom: 40 },
  title: { fontFamily: fonts.serifBold, fontSize: 30, color: colors.ink, marginTop: 8, marginBottom: 16 },
  section: { fontFamily: fonts.sans, fontSize: 11, letterSpacing: 1.3, color: colors.inkFaint, marginTop: 22, marginBottom: 8 },
  card: { backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, paddingHorizontal: 16, ...shadows.soft },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 13 },
  rowText: { flex: 1, marginRight: 12 },
  rowLabel: { fontFamily: fonts.serifSemibold, fontSize: 16, color: colors.ink },
  rowSub: { fontFamily: fonts.sans, fontSize: 12, color: colors.inkFaint, marginTop: 2 },
  hr: { height: 1, backgroundColor: colors.line },
  linkRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 15 },
  linkText: { fontFamily: fonts.serifSemibold, fontSize: 16, color: colors.ink },
  danger: { color: colors.bad },
  chevron: { fontFamily: fonts.serif, fontSize: 20, color: colors.inkFaint },
  note: { fontFamily: fonts.sans, fontSize: 12, color: colors.inkFaint, marginTop: 8, lineHeight: 16, fontStyle: "italic" },
  footer: { fontFamily: fonts.sans, fontSize: 12, color: colors.inkFaint, textAlign: "center", marginTop: 30 },
});
