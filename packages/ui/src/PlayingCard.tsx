import { Image, StyleSheet, Text, View } from "react-native";
import type { StyleProp, ViewStyle } from "react-native";

import { cardImage } from "./cards";
import { colors, fonts } from "./theme/tokens";

/** Native pixel aspect of the bundled card PNGs (222×323) — width / height. */
export const CARD_ASPECT = 222 / 323;

interface Props {
  /** Card value, A–K = 1–13. */
  value: number;
  /** Unicode suit glyph ♠♥♦♣ (from the caller's suitData). */
  suitGlyph: string;
  /** Container sizing — the parent should set width/aspect; the image fills it. */
  style?: StyleProp<ViewStyle>;
  /** Dim the card (e.g. a card already placed in the expression). */
  faded?: boolean;
}

function pip(v: number): string {
  if (v === 1) return "A";
  if (v === 11) return "J";
  if (v === 12) return "Q";
  if (v === 13) return "K";
  return String(v);
}

/**
 * A real playing card rendered from the bundled public-domain PNG deck. Purely
 * presentational — the parent owns sizing, press handling, and any framing. The
 * image keeps its own aspect via `resizeMode="contain"`, so give the container
 * the card aspect (CARD_ASPECT) for a snug fit. Falls back to a plain pip+glyph
 * only if the value/suit is somehow out of range.
 */
export function PlayingCard({ value, suitGlyph, style, faded }: Props) {
  const src = cardImage(value, suitGlyph);
  return (
    <View style={[styles.wrap, faded && styles.faded, style]}>
      {src !== null ? (
        <Image source={src} style={styles.img} resizeMode="contain" />
      ) : (
        <Text style={styles.fallback}>
          {pip(value)}
          {suitGlyph}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center", justifyContent: "center" },
  img: { width: "100%", height: "100%" },
  faded: { opacity: 0.4 },
  fallback: { fontFamily: fonts.serif, fontSize: 28, fontWeight: "700", color: colors.ink },
});
