import { StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, fonts, radius, Tappable } from "@twenty-something/ui";

interface Props {
  onPlay: () => void;
  onDaily: () => void;
  onStats: () => void;
  onInstructions: () => void;
  /** True once today's daily has been played — locks the Daily button. */
  dailyDone?: boolean;
}

/** Landing screen: brand, the three entry points, and the "i" → Instructions. */
export function HomeScreen({ onPlay, onDaily, onStats, onInstructions, dailyDone }: Props) {
  return (
    <SafeAreaView style={styles.safe}>
      <Tappable style={styles.info} onPress={onInstructions} hitSlop={12} accessibilityLabel="How to play">
        <Text style={styles.infoText}>i</Text>
      </Tappable>

      <View style={styles.hero}>
        <Text style={styles.wordmark}>
          20<Text style={styles.dot}>·</Text>Something
        </Text>
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
          {dailyDone && <Text style={styles.dailySub}>Played today · try again tomorrow</Text>}
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
  infoText: { fontFamily: fonts.serif, fontStyle: "italic", fontSize: 18, fontWeight: "700", color: colors.inkDim },
  hero: { flex: 1, justifyContent: "center", alignItems: "center" },
  wordmark: { fontFamily: fonts.serif, fontSize: 40, fontWeight: "700", color: colors.ink },
  dot: { color: colors.accent },
  menu: { paddingBottom: 48, gap: 12 },
  btn: { paddingVertical: 17, borderRadius: radius.md, alignItems: "center" },
  btnDisabled: { opacity: 0.5 },
  primary: { backgroundColor: colors.accent },
  primaryText: { fontFamily: fonts.serif, fontSize: 18, fontWeight: "700", color: colors.accentInk },
  secondary: { backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.line2 },
  secondaryText: { fontFamily: fonts.serif, fontSize: 16, fontWeight: "600", color: colors.ink },
  dailySub: { fontFamily: fonts.sans, fontSize: 11, color: colors.inkFaint, marginTop: 3 },
});
