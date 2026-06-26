import { useState } from "react";
import { Keyboard, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { Variant } from "@twenty-something/core";
import { colors, fonts, radius, shadows, Tappable } from "@twenty-something/ui";

import { decodeChallenge, type Challenge } from "../logic";
import { variantLabel } from "./format";

/** Hand-count choices for a friend challenge. */
const HAND_OPTIONS = [5, 10, 20];

interface Props {
  /** Remembered display name, so repeat challengers don't retype it. */
  defaultName?: string;
  /** Which pane to open on — "create" when arriving from a rematch. */
  initialView?: "hub" | "create";
  /** Create a fresh challenge: play these hands, then share the code from the summary. */
  onCreate: (variant: Variant, hands: number, name: string) => void;
  /** Accept a pasted challenge: re-deal its hands and play head-to-head. */
  onAccept: (challenge: Challenge) => void;
  onBack: () => void;
}

type Pane = "hub" | "create" | "enter";

/**
 * Friend challenges: create one to share (play the hands, then send the code from
 * the summary) or paste a code to play someone else's hands head-to-head. All
 * offline — the code is the whole transport.
 */
export function ChallengeScreen({ defaultName = "", initialView = "hub", onCreate, onAccept, onBack }: Props) {
  const [view, setView] = useState<Pane>(initialView);
  const [variant, setVariant] = useState<Variant>("24");
  const [hands, setHands] = useState<number>(5);
  const [name, setName] = useState<string>(defaultName);
  const [code, setCode] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  const back = () => (view === "hub" ? onBack() : (setView("hub"), setError(null)));

  const tryAccept = () => {
    Keyboard.dismiss();
    const challenge = decodeChallenge(code);
    if (!challenge) {
      setError("That code doesn't look right. Check it and try again.");
      return;
    }
    onAccept(challenge);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <Tappable style={styles.back} onPress={back} hitSlop={12} accessibilityLabel="Back">
        <Text style={styles.backText}>‹ Back</Text>
      </Tappable>

      <Text style={styles.title}>Play a friend</Text>

      {view === "hub" && (
        <View style={styles.menu}>
          <Text style={styles.blurb}>
            Same four cards, played whenever you each get to it. Send a challenge or drop in a code you were sent.
          </Text>
          <Tappable style={[styles.btn, styles.primary]} onPress={() => setView("create")}>
            <Text style={styles.primaryText}>Send a challenge</Text>
          </Tappable>
          <Tappable style={[styles.btn, styles.secondary]} onPress={() => setView("enter")}>
            <Text style={styles.secondaryText}>Enter a code</Text>
          </Tappable>
        </View>
      )}

      {view === "create" && (
        <View>
          <Text style={styles.label}>VARIANT</Text>
          <View style={styles.choiceRow}>
            {(["24", "20_something"] as Variant[]).map((v) => (
              <Tappable
                key={v}
                style={[styles.choice, variant === v && styles.choiceOn]}
                onPress={() => setVariant(v)}
                accessibilityState={{ selected: variant === v }}
              >
                <Text style={[styles.choiceText, variant === v && styles.choiceTextOn]}>{variantLabel(v)}</Text>
              </Tappable>
            ))}
          </View>

          <Text style={styles.label}>HANDS</Text>
          <View style={styles.choiceRow}>
            {HAND_OPTIONS.map((n) => (
              <Tappable
                key={n}
                style={[styles.choice, hands === n && styles.choiceOn]}
                onPress={() => setHands(n)}
                accessibilityState={{ selected: hands === n }}
              >
                <Text style={[styles.choiceText, hands === n && styles.choiceTextOn]}>{n}</Text>
              </Tappable>
            ))}
          </View>

          <Text style={styles.label}>YOUR NAME (OPTIONAL)</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="Anonymous"
            placeholderTextColor={colors.inkFaint}
            maxLength={16}
            autoCapitalize="words"
            returnKeyType="done"
          />

          <Text style={styles.hint}>You'll play the hands first, then share the code from your results.</Text>
          <Tappable style={[styles.btn, styles.primary, styles.cta]} onPress={() => onCreate(variant, hands, name.trim())}>
            <Text style={styles.primaryText}>Play & create code</Text>
          </Tappable>
        </View>
      )}

      {view === "enter" && (
        <View>
          <Text style={styles.label}>CHALLENGE CODE</Text>
          <TextInput
            style={[styles.input, styles.codeInput]}
            value={code}
            onChangeText={(t) => {
              setCode(t);
              if (error) setError(null);
            }}
            placeholder="TS1.24.…"
            placeholderTextColor={colors.inkFaint}
            autoCapitalize="characters"
            autoCorrect={false}
            returnKeyType="go"
            onSubmitEditing={tryAccept}
          />
          {error && <Text style={styles.error}>{error}</Text>}
          <Text style={styles.hint}>Paste the code a friend sent you to play their exact hands.</Text>
          <Tappable style={[styles.btn, styles.primary, styles.cta]} onPress={tryAccept}>
            <Text style={styles.primaryText}>Play it</Text>
          </Tappable>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: 24 },
  back: { paddingTop: 8, paddingBottom: 4 },
  backText: { fontFamily: fonts.sans, fontSize: 15, color: colors.inkDim },
  title: { fontFamily: fonts.serifBold, fontSize: 30, color: colors.ink, marginTop: 12, marginBottom: 24 },
  menu: { gap: 12 },
  blurb: { fontFamily: fonts.sans, fontSize: 14, lineHeight: 20, color: colors.inkDim, marginBottom: 12 },
  label: { fontFamily: fonts.sans, fontSize: 11, letterSpacing: 1.4, color: colors.inkFaint, marginBottom: 10, marginTop: 18 },
  choiceRow: { flexDirection: "row", gap: 10 },
  choice: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line2,
    backgroundColor: colors.panel,
    alignItems: "center",
  },
  choiceOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  choiceText: { fontFamily: fonts.serifSemibold, fontSize: 16, color: colors.ink },
  choiceTextOn: { color: colors.accentInk },
  input: {
    fontFamily: fonts.serifSemibold,
    fontSize: 18,
    color: colors.ink,
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.line2,
    borderRadius: radius.md,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  codeInput: { fontFamily: fonts.mono, fontSize: 16 },
  hint: { fontFamily: fonts.sans, fontSize: 13, color: colors.inkFaint, marginTop: 14, lineHeight: 18 },
  error: { fontFamily: fonts.sans, fontSize: 13, color: colors.bad, marginTop: 10 },
  btn: { paddingVertical: 17, borderRadius: radius.md, alignItems: "center" },
  cta: { marginTop: 22 },
  primary: { backgroundColor: colors.accent, ...shadows.accent },
  primaryText: { fontFamily: fonts.serifBold, fontSize: 17, color: colors.accentInk },
  secondary: { backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.line2, ...shadows.soft },
  secondaryText: { fontFamily: fonts.serifSemibold, fontSize: 16, color: colors.ink },
});
