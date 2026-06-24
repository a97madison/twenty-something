import { Modal, StyleSheet, Text, View, Pressable } from "react-native";
import { colors, fonts, radius } from "../theme/tokens";

interface Props {
  /** The card being edited (0–3), or null when the picker is closed. */
  index: number | null;
  /** Current value of that card, to highlight the active chip. */
  current: number | null;
  onSelect: (value: number) => void;
  onDismiss: () => void;
}

const VALUES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13];

function pip(v: number): string {
  if (v === 1) return "A";
  if (v === 11) return "J";
  if (v === 12) return "Q";
  if (v === 13) return "K";
  return String(v);
}

/** Tap-to-pick value editor for a single card (solver mode). */
export function ValuePicker({ index, current, onSelect, onDismiss }: Props) {
  return (
    <Modal
      visible={index !== null}
      transparent
      animationType="fade"
      onRequestClose={onDismiss}
    >
      <Pressable style={styles.backdrop} onPress={onDismiss}>
        {/* Inner press is swallowed so taps on the sheet don't dismiss it. */}
        <Pressable style={styles.sheet} onPress={() => {}}>
          <Text style={styles.title}>
            {index !== null ? `Card ${index + 1} value` : "Value"}
          </Text>
          <View style={styles.grid}>
            {VALUES.map((v) => {
              const active = v === current;
              return (
                <Pressable
                  key={v}
                  onPress={() => onSelect(v)}
                  style={[styles.chip, active && styles.chipActive]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={`Set value ${pip(v)}`}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>
                    {pip(v)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(31, 42, 34, 0.45)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: colors.bg,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderColor: colors.line,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 34,
  },
  title: {
    fontFamily: fonts.sans,
    fontSize: 11,
    letterSpacing: 1,
    color: colors.inkFaint,
    marginBottom: 14,
    marginHorizontal: 2,
  },
  grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 7 },
  chip: {
    width: "12%",
    paddingVertical: 13,
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderWidth: 1,
    borderRadius: radius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  chipActive: { borderColor: colors.accent, borderWidth: 1.5, backgroundColor: "#e8efe7" },
  chipText: { fontFamily: fonts.serif, fontSize: 17, fontWeight: "700", color: colors.ink },
  chipTextActive: { color: colors.accent },
});
