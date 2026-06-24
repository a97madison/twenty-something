import { StyleSheet, Text, View } from "react-native";
import { colors, fonts } from "@twenty-something/ui";

import { MAX_STARS } from "../logic";

interface Props {
  /** Rating in [0, MAX_STARS], or null when there isn't one yet. */
  value: number | null;
  /** Star glyph size. */
  size?: number;
}

/**
 * Five-star rating row with half-star resolution. Full stars up to floor(value),
 * a half star when the remainder ≥ 0.25, empty stars after. Purely visual.
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
  star: { color: colors.accent, fontFamily: fonts.serif },
  dim: { color: colors.inkFaint },
});
