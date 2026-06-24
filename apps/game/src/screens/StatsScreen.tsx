import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { Variant } from "@twenty-something/core";
import { colors, fonts, radius, shadows, Tappable } from "@twenty-something/ui";

import { VARIANTS, allTimeRollup, weeklyRollup, msUntilWeeklyReset, type AllStats, type Rollup } from "../logic";
import { RatingStars } from "./RatingStars";
import { formatAccuracy, formatCloses, formatRating, formatSolve, variantLabel } from "./format";

/** Lifetime hands before the all-time rating unlocks. */
const ALLTIME_GATE = 10;
/** Hands this week before the weekly rating unlocks. */
const WEEKLY_GATE = 5;

interface Props {
  stats: AllStats;
  dayKey: string;
  onBack: () => void;
}

/** Per-variant stats: accuracy, avg time, and rating (★), all-time + weekly, gated. */
export function StatsScreen({ stats, dayKey, onBack }: Props) {
  return (
    <SafeAreaView style={styles.safe}>
      <Tappable style={styles.back} onPress={onBack} hitSlop={12} accessibilityLabel="Back">
        <Text style={styles.backText}>‹ Back</Text>
      </Tappable>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>Stats</Text>
        {VARIANTS.map((v) => (
          <VariantCard key={v} variant={v} stats={stats} dayKey={dayKey} weekCloses={formatCloses(msUntilWeeklyReset(Date.now()))} />
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

function VariantCard({ variant, stats, dayKey, weekCloses }: { variant: Variant; stats: AllStats; dayKey: string; weekCloses: string }) {
  const vs = stats[variant];
  const allTime = allTimeRollup(vs);
  const weekly = weeklyRollup(vs, dayKey);

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{variantLabel(variant)}</Text>

      <Window
        label="ALL-TIME"
        rollup={allTime}
        ratingGated={allTime.count < ALLTIME_GATE}
        gateMsg={`Play ${ALLTIME_GATE - allTime.count} more to see your rating`}
      />
      <View style={styles.hr} />
      <Window
        label={`THIS WEEK (${weekCloses})`}
        rollup={weekly}
        ratingGated={weekly.count < WEEKLY_GATE}
        gateMsg="Not enough hands this week yet"
      />

      <View style={styles.hr} />
      <View style={styles.window}>
        <Text style={styles.windowLabel}>RECORDS</Text>
        <View style={styles.metaRow}>
          <Meta label="Best streak" value={String(vs.bestStreak)} />
          <Meta label="Best time" value={vs.bestTimeMs === null ? "—" : formatSolve(vs.bestTimeMs)} />
        </View>
      </View>
    </View>
  );
}

function Window({ label, rollup, ratingGated, gateMsg }: { label: string; rollup: Rollup; ratingGated: boolean; gateMsg: string }) {
  return (
    <View style={styles.window}>
      <Text style={styles.windowLabel}>{label}</Text>
      <View style={styles.ratingRow}>
        {ratingGated ? (
          <Text style={styles.gate}>{gateMsg}</Text>
        ) : (
          <>
            <RatingStars value={rollup.rating} size={20} />
            <Text style={styles.ratingNum}>{formatRating(rollup.rating)}</Text>
          </>
        )}
      </View>
      <View style={styles.metaRow}>
        <Meta label="Accuracy" value={formatAccuracy(rollup.accuracy)} />
        <Meta label="Avg time" value={rollup.avgTimeMs === null ? "—" : formatSolve(rollup.avgTimeMs)} />
        <Meta label="Hands" value={String(rollup.count)} />
      </View>
    </View>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.meta}>
      <Text style={styles.metaValue}>{value}</Text>
      <Text style={styles.metaLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  back: { paddingTop: 8, paddingBottom: 4, paddingHorizontal: 24 },
  backText: { fontFamily: fonts.sans, fontSize: 15, color: colors.inkDim },
  scroll: { paddingHorizontal: 24, paddingBottom: 40 },
  title: { fontFamily: fonts.serifBold, fontSize: 30, color: colors.ink, marginTop: 8, marginBottom: 20 },
  card: { backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, padding: 18, marginBottom: 16, ...shadows.card },
  cardTitle: { fontFamily: fonts.serifBold, fontSize: 20, color: colors.accent, marginBottom: 14 },
  window: { gap: 10 },
  windowLabel: { fontFamily: fonts.sans, fontSize: 11, letterSpacing: 1.3, color: colors.inkFaint },
  ratingRow: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 24 },
  ratingNum: { fontFamily: fonts.serifBold, fontSize: 22, color: colors.ink },
  gate: { fontFamily: fonts.sans, fontSize: 13, fontStyle: "italic", color: colors.inkFaint },
  metaRow: { flexDirection: "row", gap: 10 },
  meta: { flex: 1, backgroundColor: colors.panel2, borderRadius: radius.sm, paddingVertical: 10, alignItems: "center" },
  metaValue: { fontFamily: fonts.serifBold, fontSize: 18, color: colors.ink },
  metaLabel: { fontFamily: fonts.sans, fontSize: 10, letterSpacing: 0.8, color: colors.inkFaint, marginTop: 2 },
  hr: { height: 1, backgroundColor: colors.line, marginVertical: 16 },
});
