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
 * Five-star rating row with true fractional fill. Each star fills to exactly
 * its share of the value — for 2.4 the first two stars are solid, the third is
 * 40% filled from the left, and the last two are empty. Done by overlaying a
 * solid ★ clipped to that fraction over an outline ☆. Purely visual; the exact
 * rating is shown numerically beside it.
 */
export function RatingStars({ value, size = 22 }: Props) {
  const dim = value === null;
  const v = value ?? 0;
  return (
    <View
      style={styles.row}
      accessibilityLabel={dim ? "no rating yet" : `${v.toFixed(2)} of ${MAX_STARS} stars`}
    >
      {Array.from({ length: MAX_STARS }, (_, i) => (
        <Star key={i} frac={clamp01(v - i)} size={size} dim={dim} />
      ))}
    </View>
  );
}

/** One star: an outline base with a left-anchored solid star clipped to `frac`. */
function Star({ frac, size, dim }: { frac: number; size: number; dim: boolean }) {
  const color = dim ? colors.inkFaint : colors.accent;
  // lineHeight pinned to size so the base and the clipped overlay share metrics.
  const glyph = [styles.glyph, { fontSize: size, lineHeight: size, width: size, color }];
  return (
    <View style={{ width: size, height: size }}>
      <Text style={glyph}>☆</Text>
      {frac > 0 && (
        <View style={[styles.fill, { width: size * frac }]}>
          <Text style={glyph}>★</Text>
        </View>
      )}
    </View>
  );
}

function clamp01(x: number): number {
  return x < 0 ? 0 : x > 1 ? 1 : x;
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: 2 },
  // Fixed width + left align so the outline and the clipped solid star line up.
  glyph: { textAlign: "left" },
  // The solid overlay, anchored left and clipped to the fill fraction.
  fill: { position: "absolute", left: 0, top: 0, bottom: 0, overflow: "hidden" },
});
