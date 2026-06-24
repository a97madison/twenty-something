import { StyleSheet, Text, View } from "react-native";
import { colors } from "@twenty-something/ui";

import { MAX_STARS } from "../logic";

interface Props {
  /** Rating in [0, MAX_STARS], or null when there isn't one yet. */
  value: number | null;
  /** Star glyph size. */
  size?: number;
}

/**
 * Five-star rating row. Each position fills once the rating reaches its midpoint
 * (so a value of 2.5 lights three stars), rounding to the nearest whole star.
 * The exact rating is shown numerically beside it. Purely visual.
 */
export function RatingStars({ value, size = 22 }: Props) {
  const v = value ?? 0;
  const glyphs: string[] = [];
  for (let i = 0; i < MAX_STARS; i++) {
    // Round each position to the nearest whole star (≥ .5 of the way fills it).
    glyphs.push(v - i >= 0.5 ? "★" : "☆");
  }
  return (
    <View style={styles.row} accessibilityLabel={value === null ? "no rating yet" : `${value.toFixed(2)} of ${MAX_STARS} stars`}>
      {glyphs.map((g, i) => (
        <Text key={i} style={[styles.star, { fontSize: size }, value === null && styles.dim]}>
          {g}
        </Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: 2 },
  // No custom fontFamily: ★/☆ aren't in the serif face, so fall back to the
  // system font, which has them. (The numeric rating beside the row is serif.)
  star: { color: colors.accent },
  dim: { color: colors.inkFaint },
});
