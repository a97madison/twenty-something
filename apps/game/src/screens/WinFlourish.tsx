import { useEffect, useRef, useState } from "react";
import { Animated, StyleSheet, View } from "react-native";
import type { LayoutChangeEvent } from "react-native";
import { colors, fonts } from "@twenty-something/ui";

/** Stars in the radial burst. */
const BURST = 9;
/** How long the whole celebration plays (ms). */
const DURATION = 750;

/**
 * A brief, on-brand celebration for a fast, near-perfect solve: a ring of stars
 * bursts outward from center while a big star pops, then it all fades. Stays in
 * the cozy paper/felt palette (felt-green stars, no plastic confetti) and uses
 * the built-in Animated API only — no new deps. Rendered pointer-events-off so it
 * never blocks the tap-to-continue curtain underneath. Mount it keyed by a nonce
 * so each great solve replays it from the start.
 */
export function WinFlourish() {
  const t = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(t, { toValue: 1, duration: DURATION, useNativeDriver: true }).start();
  }, [t]);

  // Center on this overlay's OWN box (it fills its parent), so the burst is
  // correct wherever it's mounted — not tied to the full window.
  const [box, setBox] = useState({ w: 0, h: 0 });
  const onLayout = (e: LayoutChangeEvent) => setBox({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height });
  const cx = box.w / 2;
  const cy = box.h / 2;
  const radius = Math.min(box.w, box.h) * 0.42;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none" accessibilityLabel="great solve" onLayout={onLayout}>
      {box.w > 0 && (
        <>
          <Animated.Text
            style={[
              styles.core,
              {
                left: cx - 40,
                top: cy - 52,
                opacity: t.interpolate({ inputRange: [0, 0.2, 0.8, 1], outputRange: [0, 1, 1, 0] }),
                transform: [{ scale: t.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0.3, 1.25, 1.05] }) }],
              },
            ]}
          >
            ★
          </Animated.Text>

          {Array.from({ length: BURST }).map((_, i) => {
            const a = (i / BURST) * Math.PI * 2;
            return (
              <Animated.Text
                key={i}
                style={[
                  styles.spark,
                  {
                    left: cx - 11,
                    top: cy - 13,
                    opacity: t.interpolate({ inputRange: [0, 0.15, 0.85, 1], outputRange: [0, 1, 0.85, 0] }),
                    transform: [
                      { translateX: t.interpolate({ inputRange: [0, 1], outputRange: [0, Math.cos(a) * radius] }) },
                      { translateY: t.interpolate({ inputRange: [0, 1], outputRange: [0, Math.sin(a) * radius] }) },
                      { scale: t.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1.1] }) },
                    ],
                  },
                ]}
              >
                ★
              </Animated.Text>
            );
          })}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  // ★/☆ live on the system font (Fraunces has no star glyph — see fonts.ts).
  core: { position: "absolute", width: 80, textAlign: "center", fontSize: 68, color: colors.accent, fontFamily: fonts.sans },
  spark: { position: "absolute", width: 22, textAlign: "center", fontSize: 20, color: colors.accentSoft, fontFamily: fonts.sans },
});
