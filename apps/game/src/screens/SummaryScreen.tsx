import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { Variant } from "@twenty-something/core";
import { colors, fonts, radius, Tappable } from "@twenty-something/ui";

import { allTimeRollup, weeklyRollup, msUntilWeeklyReset, type AllStats, type GameState } from "../logic";
import { RatingStars } from "./RatingStars";
import { formatAccuracy, formatCloses, formatRating, formatSolve, variantLabel } from "./format";

/** Lifetime hands before the all-time rating unlocks. */
const ALLTIME_GATE = 10;
/** Hands this week before the weekly rating unlocks. */
const WEEKLY_GATE = 5;

interface Props {
  variant: Variant;
  mode: "practice" | "daily";
  /** Stats as they were BEFORE this session (for the previous→new delta). */
  previousStats: AllStats;
  /** Final engine state after the session (stats already include it). */
  finalState: GameState;
  dayKey: string;
  onPlayAgain: () => void;
  onHome: () => void;
}

/** End-of-game summary: this session's results plus the all-time / weekly rating block. */
export function SummaryScreen({ variant, mode, previousStats, finalState, dayKey, onPlayAgain, onHome }: Props) {
  const s = finalState.session;
  const sessionRating = s.total === 0 ? null : s.starSum / s.total;
  const sessionAccuracy = s.total === 0 ? null : s.correct / s.total;
  const sessionAvg = s.correct === 0 ? null : s.timeSumCorrect / s.correct;

  const prevRollup = allTimeRollup(previousStats[variant]);
  const newRollup = allTimeRollup(finalState.stats[variant]);
  const weekly = weeklyRollup(finalState.stats[variant], dayKey);

  const allTimeUnlocked = newRollup.count >= ALLTIME_GATE;
  const weeklyUnlocked = weekly.count >= WEEKLY_GATE;
  const delta = prevRollup.rating !== null && newRollup.rating !== null ? newRollup.rating - prevRollup.rating : null;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.kicker}>{mode === "daily" ? "Daily challenge" : variantLabel(variant)}</Text>

        {/* Headline: this game's rating. */}
        <View style={styles.headline}>
          <RatingStars value={sessionRating} size={30} />
          <Text style={styles.headlineNum}>{formatRating(sessionRating)}</Text>
          <Text style={styles.headlineLabel}>this game</Text>
        </View>

        <View style={styles.statsRow}>
          <Cell label="CORRECT" value={`${s.correct}/${s.total}`} />
          <Cell label="ACCURACY" value={formatAccuracy(sessionAccuracy)} />
          <Cell label="AVG TIME" value={sessionAvg === null ? "—" : formatSolve(sessionAvg)} />
        </View>

        {mode === "daily" && (
          <View style={styles.percentile}>
            <Text style={styles.percentileText}>Percentile vs today's players — coming with the online update.</Text>
          </View>
        )}

        {/* All-time rating: previous → Δ → new. */}
        <Text style={styles.section}>ALL-TIME RATING · {variantLabel(variant)}</Text>
        {allTimeUnlocked ? (
          <View style={styles.deltaRow}>
            <Text style={styles.deltaPrev}>{formatRating(prevRollup.rating)}</Text>
            <Text style={styles.arrow}>→</Text>
            <Text style={styles.deltaNew}>{formatRating(newRollup.rating)}</Text>
            {delta !== null && Math.abs(delta) >= 0.005 && (
              <Text style={[styles.deltaTag, delta >= 0 ? styles.deltaUp : styles.deltaDown]}>
                {delta >= 0 ? "▲" : "▼"} {Math.abs(delta).toFixed(2)}
              </Text>
            )}
          </View>
        ) : (
          <Text style={styles.locked}>Play {ALLTIME_GATE - newRollup.count} more hand{ALLTIME_GATE - newRollup.count === 1 ? "" : "s"} to unlock your rating.</Text>
        )}

        <Text style={styles.section}>THIS WEEK ({formatCloses(msUntilWeeklyReset(Date.now()))})</Text>
        {weeklyUnlocked ? (
          <View style={styles.weeklyRow}>
            <RatingStars value={weekly.rating} size={18} />
            <Text style={styles.weeklyNum}>{formatRating(weekly.rating)}</Text>
            <Text style={styles.weeklyMeta}>
              {formatAccuracy(weekly.accuracy)} · {weekly.avgTimeMs === null ? "—" : formatSolve(weekly.avgTimeMs)}
            </Text>
          </View>
        ) : (
          <Text style={styles.locked}>Not enough hands this week yet.</Text>
        )}

        <View style={styles.actions}>
          {mode !== "daily" && (
            <Tappable style={[styles.btn, styles.primary]} onPress={onPlayAgain}>
              <Text style={styles.primaryText}>Play again</Text>
            </Tappable>
          )}
          <Tappable style={[styles.btn, styles.secondary]} onPress={onHome}>
            <Text style={styles.secondaryText}>Back to home</Text>
          </Tappable>
          {mode === "daily" && <Text style={styles.tomorrow}>Try again tomorrow</Text>}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.cell}>
      <Text style={styles.cellLabel}>{label}</Text>
      <Text style={styles.cellValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { flexGrow: 1, justifyContent: "center", paddingHorizontal: 24, paddingVertical: 24 },
  kicker: { fontFamily: fonts.sans, fontSize: 12, letterSpacing: 1.4, color: colors.inkFaint, textAlign: "center" },
  tomorrow: { fontFamily: fonts.sans, fontSize: 13, color: colors.inkFaint, textAlign: "center", marginTop: 4 },
  headline: { alignItems: "center", marginTop: 22, marginBottom: 22 },
  headlineNum: { fontFamily: fonts.serifBold, fontSize: 44, color: colors.accent, marginTop: 8 },
  headlineLabel: { fontFamily: fonts.sans, fontSize: 12, letterSpacing: 1, color: colors.inkFaint },
  statsRow: { flexDirection: "row", gap: 10 },
  cell: { flex: 1, backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, paddingVertical: 12, alignItems: "center" },
  cellLabel: { fontFamily: fonts.sans, fontSize: 10, letterSpacing: 1, color: colors.inkFaint },
  cellValue: { fontFamily: fonts.serifBold, fontSize: 20, color: colors.ink, marginTop: 3 },
  percentile: { marginTop: 14, padding: 12, borderRadius: radius.md, backgroundColor: colors.panel2, borderWidth: 1, borderColor: colors.line },
  percentileText: { fontFamily: fonts.sans, fontSize: 12, color: colors.inkDim, textAlign: "center" },
  section: { fontFamily: fonts.sans, fontSize: 11, letterSpacing: 1.4, color: colors.inkFaint, marginTop: 26, marginBottom: 10 },
  deltaRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  deltaPrev: { fontFamily: fonts.serif, fontSize: 22, color: colors.inkDim }, // dimmed prior rating — regular weight
  arrow: { fontFamily: fonts.sans, fontSize: 18, color: colors.inkFaint },
  deltaNew: { fontFamily: fonts.serifBold, fontSize: 30, color: colors.ink },
  deltaTag: { fontFamily: fonts.sans, fontSize: 14, fontWeight: "600" },
  deltaUp: { color: colors.good },
  deltaDown: { color: colors.bad },
  weeklyRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  weeklyNum: { fontFamily: fonts.serifBold, fontSize: 22, color: colors.ink },
  weeklyMeta: { fontFamily: fonts.sans, fontSize: 13, color: colors.inkDim },
  locked: { fontFamily: fonts.sans, fontSize: 13, color: colors.inkFaint, fontStyle: "italic" },
  actions: { marginTop: 36, gap: 12 },
  btn: { paddingVertical: 16, borderRadius: radius.md, alignItems: "center" },
  primary: { backgroundColor: colors.accent },
  primaryText: { fontFamily: fonts.serifBold, fontSize: 17, color: colors.accentInk },
  secondary: { backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.line2 },
  secondaryText: { fontFamily: fonts.serifSemibold, fontSize: 16, color: colors.ink },
});
