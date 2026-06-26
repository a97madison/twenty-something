import { StyleSheet, Text, View } from "react-native";
import { colors, fonts, radius } from "@twenty-something/ui";

import { RatingStars } from "./RatingStars";
import { formatSolve } from "./format";

/** Everything the postable card shows. Outcome-only — never a card, target, or
 *  solution (the same spoiler-free rule as the share text). */
export interface ShareCardData {
  date: string; // "YYYY-MM-DD"
  rating: number | null; // session stars 0–5
  solved: number;
  total: number;
  totalTimeSec?: number | null;
  accuracy?: number | null; // 0–1
  streak?: number; // daily streak
  percentile?: number | null; // beat X% of today's field
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2026-06-25" → "Jun 25, 2026". Pure; tolerates a malformed key. */
function prettyDate(key: string): string {
  const [y, m, d] = key.split("-").map(Number);
  if (!y || !m || !d || m < 1 || m > 12) return key;
  return `${MONTHS[m - 1]} ${d}, ${y}`;
}

/**
 * The branded, spoiler-free result card — the thing a player posts. A self-
 * contained artifact (wordmark + date + stars + the headline stats), distinct
 * from the rest of the summary so it reads as "the card". Built from plain views
 * so it can later be captured to a PNG (react-native-view-shot) for image share;
 * today it's the in-app preview above the share button.
 */
export function ShareCard({ data }: { data: ShareCardData }) {
  const { date, rating, solved, total, totalTimeSec, accuracy, streak, percentile } = data;
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.wordmark}>
          20<Text style={styles.dot}>·</Text>Something
        </Text>
        <Text style={styles.kicker}>DAILY</Text>
      </View>
      <Text style={styles.date}>{prettyDate(date)}</Text>

      <View style={styles.hero}>
        <RatingStars value={rating} size={26} />
        <Text style={styles.solved}>
          {solved}/{total} solved
        </Text>
      </View>

      <View style={styles.chips}>
        {typeof totalTimeSec === "number" && totalTimeSec > 0 && <Chip glyph="⚡" text={formatSolve(totalTimeSec * 1000)} />}
        {typeof accuracy === "number" && <Chip glyph="🎯" text={`${Math.round(accuracy * 100)}%`} />}
        {typeof streak === "number" && streak > 0 && <Chip glyph="🔥" text={`${streak}`} />}
      </View>

      {typeof percentile === "number" && <Text style={styles.percentile}>🏅 Better than {percentile}% today</Text>}

      <Text style={styles.footer}>play 20·Something</Text>
    </View>
  );
}

function Chip({ glyph, text }: { glyph: string; text: string }) {
  return (
    <View style={styles.chip}>
      <Text style={styles.chipText}>
        {glyph} {text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: radius.lg,
    paddingVertical: 20,
    paddingHorizontal: 22,
    alignItems: "center",
    gap: 4,
  },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10 },
  wordmark: { fontFamily: fonts.serifBold, fontSize: 22, color: colors.ink },
  dot: { color: colors.accent },
  kicker: { fontFamily: fonts.sans, fontSize: 10, letterSpacing: 2, color: colors.accent, backgroundColor: colors.panel2, paddingHorizontal: 6, paddingVertical: 2, borderRadius: radius.sm, overflow: "hidden" },
  date: { fontFamily: fonts.sans, fontSize: 12, color: colors.inkFaint, marginBottom: 8 },
  hero: { alignItems: "center", gap: 8, marginVertical: 6 },
  solved: { fontFamily: fonts.serifBold, fontSize: 22, color: colors.ink },
  chips: { flexDirection: "row", gap: 8, marginTop: 8, flexWrap: "wrap", justifyContent: "center" },
  chip: { backgroundColor: colors.panel2, borderRadius: radius.sm, paddingHorizontal: 10, paddingVertical: 5 },
  chipText: { fontFamily: fonts.serifSemibold, fontSize: 14, color: colors.ink },
  percentile: { fontFamily: fonts.serifSemibold, fontSize: 14, color: colors.accent, marginTop: 10 },
  footer: { fontFamily: fonts.sans, fontSize: 11, letterSpacing: 0.8, color: colors.inkFaint, marginTop: 12 },
});
