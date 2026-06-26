import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, fonts, Tappable } from "@twenty-something/ui";

interface Props {
  onBack: () => void;
}

/** Plain-language privacy policy. Mirrors PRIVACY.md at the repo root. */
export function PrivacyScreen({ onBack }: Props) {
  return (
    <SafeAreaView style={styles.safe}>
      <Tappable style={styles.back} onPress={onBack} hitSlop={12} accessibilityLabel="Back">
        <Text style={styles.backText}>‹ Back</Text>
      </Tappable>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>Privacy</Text>
        <Text style={styles.updated}>The short version: we collect as little as possible and never sell it.</Text>

        <Section title="What stays on your device">
          Your stats, streak, freezes, and rival records live only in this app's local
          storage on your phone. You can erase all of it any time from Settings → Delete all my data.
        </Section>

        <Section title="What touches our server">
          When you finish a daily challenge we submit just your star rating for that date so we can
          show your percentile against everyone who played. To do that, the app signs in
          anonymously — there's no account, email, or password, and the anonymous id isn't tied to
          your identity. Friend challenges work offline: the challenge code carries a random,
          device-generated player id and the display name you optionally type — nothing more.
        </Section>

        <Section title="What we do NOT collect">
          No name (beyond an optional display name you choose), email, phone number, contacts, or
          location. No advertising. No third-party analytics or trackers. We don't sell or share
          your data with anyone.
        </Section>

        <Section title="Children">
          The game is suitable for all ages. We don't knowingly collect personal information from
          children. Because we collect no personal information from anyone, there's nothing that
          identifies a child.
        </Section>

        <Section title="Your control">
          Delete all on-device data from Settings at any time. The anonymous server records can't be
          linked back to you.
        </Section>

        <Section title="Contact">
          Questions? Reach out at the support address listed on the app's store page.
        </Section>

        <Text style={styles.footer}>Last updated June 2026.</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({ title, children }: { title: string; children: string }) {
  return (
    <View style={styles.block}>
      <Text style={styles.heading}>{title}</Text>
      <Text style={styles.body}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  back: { paddingTop: 8, paddingBottom: 4, paddingHorizontal: 24 },
  backText: { fontFamily: fonts.sans, fontSize: 15, color: colors.inkDim },
  scroll: { paddingHorizontal: 24, paddingBottom: 48 },
  title: { fontFamily: fonts.serifBold, fontSize: 30, color: colors.ink, marginTop: 8 },
  updated: { fontFamily: fonts.sans, fontSize: 14, color: colors.inkDim, marginTop: 6, marginBottom: 8, lineHeight: 20 },
  block: { marginTop: 20 },
  heading: { fontFamily: fonts.serifBold, fontSize: 17, color: colors.accent, marginBottom: 6 },
  body: { fontFamily: fonts.sans, fontSize: 14, color: colors.ink, lineHeight: 21 },
  footer: { fontFamily: fonts.sans, fontSize: 12, color: colors.inkFaint, marginTop: 28 },
});
