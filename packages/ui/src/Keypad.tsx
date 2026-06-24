import { StyleSheet, Text, View, Pressable } from "react-native";
import * as Haptics from "expo-haptics";
import type { Operation } from "@twenty-something/core";

import { colors, fonts } from "./theme/tokens";
import type { CheckerToken } from "./parser";

const OPS: Operation[] = ["+", "-", "×", "÷"];

interface Props {
  /** Append a token to the expression (operator or parenthesis). */
  onPush: (t: CheckerToken) => void;
  /** Remove the last token. */
  onBackspace: () => void;
}

/**
 * The operator / parenthesis / backspace keypad for building an expression.
 * Card entry is the CardRow's job; this is everything else the player taps.
 * A selection haptic fires on every key so callers don't have to wire it.
 */
export function Keypad({ onPush, onBackspace }: Props) {
  const push = (t: CheckerToken) => {
    Haptics.selectionAsync();
    onPush(t);
  };
  const back = () => {
    Haptics.selectionAsync();
    onBackspace();
  };
  return (
    <View style={styles.keypad}>
      {OPS.map((op) => (
        <Pressable key={op} style={styles.key} onPress={() => push({ type: "op", op })}>
          <Text style={[styles.keyText, styles.keyOp]}>{op}</Text>
        </Pressable>
      ))}
      <Pressable style={styles.key} onPress={() => push({ type: "lp" })}>
        <Text style={styles.keyText}>(</Text>
      </Pressable>
      <Pressable style={styles.key} onPress={() => push({ type: "rp" })}>
        <Text style={styles.keyText}>)</Text>
      </Pressable>
      <Pressable style={styles.key} onPress={back} accessibilityLabel="Backspace">
        <Text style={styles.keyText}>⌫</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  keypad: { flexDirection: "row", flexWrap: "wrap", gap: 7, marginBottom: 14 },
  key: {
    width: "18%",
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderWidth: 1,
    borderRadius: 9,
    paddingVertical: 13,
    alignItems: "center",
  },
  keyText: { fontFamily: fonts.monoMedium, fontSize: 17, color: colors.ink },
  keyOp: { color: colors.accent },
});
