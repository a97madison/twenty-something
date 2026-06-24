import { useState, useCallback, useRef } from "react";
import { StyleSheet, Text, View, Pressable, ScrollView } from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import * as Haptics from "expo-haptics";
import {
  computeTarget,
  type Variant,
  type Card as CardModel,
} from "@twenty-something/core";

import { colors, fonts } from "./theme/tokens";
import { randomHand } from "./hand";
import { CardRow } from "./components/CardRow";
import { ValuePicker } from "./components/ValuePicker";
import { SolverPane } from "./screens/SolverPane";
import { CheckerPane } from "./screens/CheckerPane";

type Mode = "solver" | "checker";

const SUITS = [
  { s: "♠", red: false },
  { s: "♥", red: true },
  { s: "♦", red: true },
  { s: "♣", red: false },
];

/** Build the typed Hand the core expects from the current card values. */
function toHand(values: number[]): readonly [CardModel, CardModel, CardModel, CardModel] {
  return [
    { id: "c0", value: values[0]! },
    { id: "c1", value: values[1]! },
    { id: "c2", value: values[2]! },
    { id: "c3", value: values[3]! },
  ];
}

export default function App() {
  const [mode, setMode] = useState<Mode>("solver");
  const [variant, setVariant] = useState<Variant>("24");
  // Deal a fresh random hand on each launch (lazy init runs once on mount).
  const [initial] = useState(randomHand);
  const [values, setValues] = useState<number[]>(initial.values);
  const [suits, setSuits] = useState<number[]>(initial.suits);

  // Checker state lives here in the parent so it survives mode switches —
  // the same persistence the prototype's loop established. Tokens are the
  // checker's in-progress expression; clearing happens only when the hand
  // actually changes.
  const [tokens, setTokens] = useState<CheckerToken[]>([]);
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  // Which card the value picker is editing (solver mode), or null when closed.
  const [pickingIndex, setPickingIndex] = useState<number | null>(null);
  const scrollRef = useRef<ScrollView>(null);

  // After a check, reveal the verdict (it renders below the fold). Deferred a
  // frame so the verdict has been laid out before we scroll to it.
  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
  }, []);

  const hand = toHand(values);
  const target = computeTarget(variant, hand);

  const changeHand = useCallback((nextValues: number[], nextSuits: number[]) => {
    setValues(nextValues);
    setSuits(nextSuits);
    // hand changed → any in-progress checker attempt is now stale
    setTokens([]);
    setVerdict(null);
  }, []);

  // Picking a value edits only that card's value; suit is left as dealt.
  const setCardValue = useCallback(
    (value: number) => {
      if (pickingIndex === null) return;
      Haptics.selectionAsync();
      const v = values.slice();
      v[pickingIndex] = value;
      changeHand(v, suits);
      setPickingIndex(null);
    },
    [pickingIndex, values, suits, changeHand],
  );

  const onChangeVariant = useCallback((v: Variant) => {
    setVariant(v);
    // target changed → prior verdict is stale, but the expression stays valid
    setVerdict(null);
  }, []);

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.safe}>
        <StatusBar style="dark" />
        <ScrollView ref={scrollRef} contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <Text style={styles.wordmark}>
              20<Text style={styles.wordmarkDot}>·</Text>Something
            </Text>
            <Text style={styles.tagline}>calculator</Text>
          </View>

          <View style={styles.modebar}>
            <ModeTab label="Solver" active={mode === "solver"} onPress={() => setMode("solver")} />
            <ModeTab label="Checker" active={mode === "checker"} onPress={() => setMode("checker")} />
          </View>

          <View style={styles.variantbar}>
            <VariantButton
              name="24"
              active={variant === "24"}
              onPress={() => onChangeVariant("24")}
            />
            <VariantButton
              name="20-Something"
              desc="18 + target card"
              active={variant === "20_something"}
              onPress={() => onChangeVariant("20_something")}
            />
          </View>

          <View style={styles.targetReadout}>
            <Text style={styles.targetLabel}>TARGET</Text>
            <Text style={styles.targetNum}>{target}</Text>
          </View>

          <Text style={styles.cardsLabel}>
            {mode === "solver"
              ? "Tap a card to change its value"
              : "Tap a card to add it to your expression"}
          </Text>

          <CardRow
            values={values}
            suits={suits}
            suitData={SUITS}
            variant={variant}
            mode={mode}
            usedIndices={tokens.filter((t) => t.type === "card").map((t) => (t as CardToken).i)}
            onCardPress={(i) => {
              if (mode === "solver") {
                Haptics.selectionAsync();
                setPickingIndex(i);
              } else {
                const already = tokens.some((t) => t.type === "card" && (t as CardToken).i === i);
                if (already) return;
                Haptics.selectionAsync();
                setTokens([...tokens, { type: "card", i }]);
                setVerdict(null);
              }
            }}
          />

          {mode === "solver" ? (
            <SolverPane hand={hand} target={target} onDealRandom={changeHand} />
          ) : (
            <CheckerPane
              values={values}
              hand={hand}
              target={target}
              tokens={tokens}
              setTokens={setTokens}
              verdict={verdict}
              setVerdict={setVerdict}
              onChecked={scrollToBottom}
            />
          )}
        </ScrollView>

        <ValuePicker
          index={pickingIndex}
          current={pickingIndex === null ? null : values[pickingIndex]!}
          red={pickingIndex === null ? false : SUITS[suits[pickingIndex]!]!.red}
          onSelect={setCardValue}
          onDismiss={() => setPickingIndex(null)}
        />
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

function ModeTab({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.modeTab, active && styles.modeTabActive]}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
    >
      <Text style={[styles.modeTabText, active && styles.modeTabTextActive]}>{label}</Text>
    </Pressable>
  );
}

function VariantButton({
  name,
  desc,
  active,
  onPress,
}: {
  name: string;
  desc?: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.variantBtn, active && styles.variantBtnActive]}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
    >
      <Text style={styles.variantName}>{name}</Text>
      {desc ? <Text style={styles.variantDesc}>{desc}</Text> : null}
    </Pressable>
  );
}

// Shared token/verdict types used across the checker components.
export type CardToken = { type: "card"; i: number };
export type CheckerToken =
  | CardToken
  | { type: "op"; op: "+" | "-" | "×" | "÷" }
  | { type: "lp" }
  | { type: "rp" };
export type Verdict = { ok: boolean; big: string; sub: string };

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { paddingHorizontal: 18, paddingBottom: 40 },
  header: {
    paddingTop: 22,
    paddingBottom: 14,
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
  },
  wordmark: { fontFamily: fonts.serif, fontSize: 21, fontWeight: "700", color: colors.ink },
  wordmarkDot: { color: colors.accent },
  tagline: { fontFamily: fonts.serif, fontStyle: "italic", fontSize: 12, color: colors.inkFaint },
  modebar: {
    flexDirection: "row",
    gap: 4,
    backgroundColor: colors.panel2,
    borderColor: colors.line,
    borderWidth: 1,
    borderRadius: 11,
    padding: 4,
    marginBottom: 18,
  },
  modeTab: { flex: 1, paddingVertical: 9, borderRadius: 8, alignItems: "center" },
  modeTabActive: { backgroundColor: colors.panel },
  modeTabText: { fontFamily: fonts.sans, fontSize: 14, fontWeight: "500", color: colors.inkDim },
  modeTabTextActive: { color: colors.accent, fontWeight: "600" },
  variantbar: { flexDirection: "row", gap: 8, marginBottom: 20 },
  variantBtn: {
    flex: 1,
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 11,
    paddingHorizontal: 8,
  },
  variantBtnActive: { borderColor: colors.accent, backgroundColor: "#e8efe7" },
  variantName: { fontFamily: fonts.sans, fontSize: 14, fontWeight: "600", color: colors.ink },
  variantDesc: { fontFamily: fonts.sans, fontSize: 11, color: colors.inkFaint, marginTop: 2 },
  targetReadout: { alignItems: "center", marginTop: 6, marginBottom: 20 },
  targetLabel: { fontFamily: fonts.sans, fontSize: 11, letterSpacing: 1.5, color: colors.inkFaint },
  targetNum: { fontFamily: fonts.serif, fontSize: 50, fontWeight: "700", color: colors.accent, marginTop: 4 },
  cardsLabel: { fontFamily: fonts.sans, fontSize: 11, letterSpacing: 1, color: colors.inkFaint, marginBottom: 8, marginHorizontal: 2 },
});
