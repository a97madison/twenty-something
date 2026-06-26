import { StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, fonts, radius, shadows, Tappable } from "@twenty-something/ui";

import type { DailyStreakStatus } from "../logic";
import { formatHoursMinutes, msUntilLocalMidnight } from "./format";

interface Props {
  onPlay: () => void;
  onDaily: () => void;
  onChallenge: () => void;
  onRooms: () => void;
  onStats: () => void;
  onInstructions: () => void;
  onSettings: () => void;
  /** True once today's daily has been played — locks the Daily button. */
  dailyDone?: boolean;
  /** Live daily-streak status for the streak banner. */
  streak?: DailyStreakStatus;
}

/** Landing screen: brand, the entry points, the "i" → Instructions, and ⚙ → Settings. */
export function HomeScreen({ onPlay, onDaily, onChallenge, onRooms, onStats, onInstructions, onSettings, dailyDone, streak }: Props) {
  const showStreak = streak && streak.alive && streak.current >= 1;
  return (
    <SafeAreaView style={styles.safe}>
      <Tappable style={styles.info} onPress={onInstructions} hitSlop={12} accessibilityLabel="How to play">
        <Text style={styles.infoText}>i</Text>
      </Tappable>
      <Tappable style={styles.gear} onPress={onSettings} hitSlop={12} accessibilityLabel="Settings">
        <Text style={styles.gearText}>⚙</Text>
      </Tappable>

      <View style={styles.hero}>
        <Text style={styles.wordmark}>
          20<Text style={styles.dot}>·</Text>Something
        </Text>
        {showStreak && (
          <View style={styles.streak} accessibilityLabel={`${streak!.current} day streak`}>
            <Text style={styles.streakNum}>🔥 {streak!.current}</Text>
            <Text style={styles.streakLabel}>day streak</Text>
            {streak!.freezes > 0 && <Text style={styles.streakFreeze}>{"❄️".repeat(streak!.freezes)}</Text>}
          </View>
        )}
        {showStreak && streak!.atRisk && <Text style={styles.streakHint}>Play today to keep it going</Text>}
      </View>

      <View style={styles.menu}>
        <Tappable style={[styles.btn, styles.primary]} onPress={onPlay}>
          <Text style={styles.primaryText}>Play</Text>
        </Tappable>
        <Tappable
          style={[styles.btn, styles.secondary, dailyDone && styles.btnDisabled]}
          onPress={onDaily}
          disabled={dailyDone}
        >
          <Text style={styles.secondaryText}>Daily challenge</Text>
          {dailyDone && <Text style={styles.dailySub}>Next challenge in {formatHoursMinutes(msUntilLocalMidnight())}</Text>}
        </Tappable>
        <Tappable style={[styles.btn, styles.secondary]} onPress={onChallenge}>
          <Text style={styles.secondaryText}>Play a friend</Text>
        </Tappable>
        <Tappable style={[styles.btn, styles.secondary]} onPress={onRooms}>
          <Text style={styles.secondaryText}>Live rooms</Text>
        </Tappable>
        <Tappable style={[styles.btn, styles.secondary]} onPress={onStats}>
          <Text style={styles.secondaryText}>Stats</Text>
        </Tappable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: 24 },
  info: {
    position: "absolute",
    top: 56,
    right: 24,
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: colors.line2,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1,
  },
  infoText: { fontFamily: fonts.serifBold, fontSize: 18, color: colors.inkDim },
  gear: {
    position: "absolute",
    top: 56,
    left: 24,
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: colors.line2,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1,
  },
  gearText: { fontSize: 17, color: colors.inkDim },
  hero: { flex: 1, justifyContent: "center", alignItems: "center" },
  wordmark: { fontFamily: fonts.serifBold, fontSize: 40, color: colors.ink },
  dot: { color: colors.accent },
  streak: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 22 },
  streakNum: { fontFamily: fonts.serifBold, fontSize: 22, color: colors.ink },
  streakLabel: { fontFamily: fonts.sans, fontSize: 13, color: colors.inkDim },
  streakFreeze: { fontSize: 14 },
  streakHint: { fontFamily: fonts.sans, fontSize: 12, color: colors.inkFaint, marginTop: 6 },
  menu: { paddingBottom: 48, gap: 12 },
  btn: { paddingVertical: 17, borderRadius: radius.md, alignItems: "center" },
  btnDisabled: { opacity: 0.5 },
  primary: { backgroundColor: colors.accent, ...shadows.accent },
  primaryText: { fontFamily: fonts.serifBold, fontSize: 18, color: colors.accentInk },
  secondary: { backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.line2, ...shadows.soft },
  secondaryText: { fontFamily: fonts.serifSemibold, fontSize: 16, color: colors.ink },
  dailySub: { fontFamily: fonts.sans, fontSize: 11, color: colors.inkFaint, marginTop: 3 },
});
