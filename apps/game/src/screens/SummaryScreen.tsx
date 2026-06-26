import { useEffect, useRef, useState } from "react";
import { Animated, Share, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { buildDailyShareText, type Variant } from "@twenty-something/core";
import { colors, fonts, radius, shadows, Tappable, useReducedMotion } from "@twenty-something/ui";

import {
  allTimeRollup,
  weeklyRollup,
  msUntilWeeklyReset,
  encodeChallenge,
  challengeOutcome,
  type AllStats,
  type DailyStreakEvent,
  type GameState,
} from "../logic";
import { storage } from "../storage";
import { BACKEND_ENABLED } from "../backend/config";
import { submitDailyResult, type DailyPercentile } from "../backend/daily";
import { RatingStars } from "./RatingStars";
import { ShareCard } from "./ShareCard";
import { formatAccuracy, formatCloses, formatRating, formatSolve, variantLabel } from "./format";

/** Lifetime hands before the all-time rating unlocks. */
const ALLTIME_GATE = 10;
/** Hands this week before the weekly rating unlocks. */
const WEEKLY_GATE = 5;

/** Friend-challenge context carried into the summary (see App.tsx). */
interface ChallengeContext {
  role: "create" | "accept";
  seed: string;
  hands: number;
  myName?: string;
  myPlayerId?: string;
  challenger?: { name: string; rating: number; playerId?: string };
}

interface Props {
  variant: Variant;
  mode: "practice" | "daily" | "challenge";
  /** Stats as they were BEFORE this session (for the previous→new delta). */
  previousStats: AllStats;
  /** Final engine state after the session (stats already include it). */
  finalState: GameState;
  dayKey: string;
  /** Present only for friend challenges — drives the head-to-head / share-code. */
  challenge?: ChallengeContext;
  /** Daily only: the streak after this play + what happened. */
  dailyStreak?: { current: number; freezes: number; event: DailyStreakEvent };
  /** Challenge-accept only: your head-to-head record vs this friend, after this game. */
  rival?: { name: string; wins: number; losses: number; ties: number };
  onPlayAgain: () => void;
  onHome: () => void;
  /** Challenge-accept only: start a fresh challenge to send back. */
  onRematch?: () => void;
}

/** End-of-game summary: this session's results plus the all-time / weekly rating block. */
export function SummaryScreen({ variant, mode, previousStats, finalState, dayKey, challenge, dailyStreak, rival, onPlayAgain, onHome, onRematch }: Props) {
  const s = finalState.session;
  const sessionRating = s.total === 0 ? null : s.starSum / s.total;
  const sessionAccuracy = s.total === 0 ? null : s.correct / s.total;
  const sessionAvg = s.correct === 0 ? null : s.timeSumCorrect / s.correct;

  // Headline rating counts up on mount — stars and number in sync — then lands
  // with a success haptic. The little dopamine beat the quiet summary was missing.
  const countUp = useRef(new Animated.Value(0)).current;
  const [shownRating, setShownRating] = useState(0);
  const reducedMotion = useReducedMotion();
  useEffect(() => {
    if (sessionRating === null) return;
    if (reducedMotion) {
      // Reduce motion: jump straight to the final value, no count-up.
      setShownRating(sessionRating);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      return;
    }
    const id = countUp.addListener(({ value }) => setShownRating(value));
    Animated.timing(countUp, { toValue: sessionRating, duration: 750, useNativeDriver: false }).start(() => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    });
    return () => countUp.removeListener(id);
  }, [reducedMotion]); // once, when the summary mounts (or if the setting flips)
  const headlineRating = sessionRating === null ? null : shownRating;

  const prevRollup = allTimeRollup(previousStats[variant]);
  const newRollup = allTimeRollup(finalState.stats[variant]);
  const weekly = weeklyRollup(finalState.stats[variant], dayKey);

  const allTimeUnlocked = newRollup.count >= ALLTIME_GATE;
  const weeklyUnlocked = weekly.count >= WEEKLY_GATE;
  const delta = prevRollup.rating !== null && newRollup.rating !== null ? newRollup.rating - prevRollup.rating : null;

  // Daily only: submit this game's rating, get the live field percentile back.
  const live = mode === "daily" && BACKEND_ENABLED && sessionRating !== null;
  const [pct, setPct] = useState<DailyPercentile | null | "loading">(live ? "loading" : null);
  useEffect(() => {
    if (!live) return;
    let alive = true;
    submitDailyResult(storage, dayKey, variant, sessionRating!).then((r) => alive && setPct(r));
    return () => {
      alive = false;
    };
  }, []); // run once when the daily summary mounts

  // Outcome-only daily share (never reveals a method) — built by core.
  const onShare = () => {
    const message = buildDailyShareText({
      gameName: variantLabel(variant),
      date: dayKey,
      solved: s.correct,
      total: s.total,
      stars: sessionRating ?? undefined,
      totalTimeSec: s.timeSumCorrect > 0 ? Math.round(s.timeSumCorrect / 1000) : undefined,
      currentStreak: dailyStreak?.current ?? 0,
    });
    Share.share({ message }).catch(() => {});
  };

  // --- Daily streak message ----------------------------------------------------
  const streakMsg = (() => {
    if (!dailyStreak) return null;
    const { current, event } = dailyStreak;
    if (event.earnedFreeze) return `🎉 Perfect week! ${current}-day streak · banked a freeze`;
    if (event.kind === "frozen") return `❄️ Freeze used — your ${current}-day streak is safe`;
    if (event.kind === "reset") return `Streak reset — day ${current} of a new run`;
    return `🔥 ${current} day streak`;
  })();

  // --- Friend challenge --------------------------------------------------------
  const isCreate = challenge?.role === "create";
  const isAccept = challenge?.role === "accept" && challenge.challenger != null;

  // Accept: head-to-head verdict vs the challenger who sent the code.
  const challenger = challenge?.challenger;
  const versus = isAccept && sessionRating !== null ? challengeOutcome(sessionRating, challenger!.rating) : null;
  const rivalName = (challenger?.name || "").trim() || "your friend";

  // The running series vs this friend (rival counts already include this game).
  const recordLine = (() => {
    if (!rival) return null;
    const { wins, losses, ties } = rival;
    if (wins + losses + ties <= 1) return `First game vs ${rivalName}`;
    const t = ties ? `–${ties}` : "";
    if (wins > losses) return `You lead ${rivalName} ${wins}–${losses}${t}`;
    if (losses > wins) return `${rivalName} leads ${losses}–${wins}${t}`;
    return `All square with ${rivalName} ${wins}–${losses}${t}`;
  })();

  // Create: the shareable code carrying this game's seed + rating, plus a friendly invite.
  const onShareChallenge = () => {
    if (!isCreate || sessionRating === null) return;
    const code = encodeChallenge({
      seed: challenge!.seed,
      variant,
      hands: challenge!.hands,
      rating: sessionRating,
      name: challenge!.myName ?? "",
      playerId: challenge!.myPlayerId,
    });
    const message = [
      `I scored ${sessionRating.toFixed(1)}★ on a ${variantLabel(variant)} challenge — same ${challenge!.hands} hands. Can you beat me?`,
      `Open 20·Something → Play a friend → Enter a code:`,
      code,
    ].join("\n");
    Share.share({ message }).catch(() => {});
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.kicker}>
          {mode === "daily"
            ? "Daily challenge"
            : mode === "challenge"
              ? isCreate
                ? "Friend challenge"
                : `${rivalName}'s challenge`
              : variantLabel(variant)}
        </Text>

        {/* Headline: this game's rating. */}
        <View style={styles.headline}>
          <RatingStars value={headlineRating} size={30} />
          <Text style={styles.headlineNum}>{formatRating(headlineRating)}</Text>
          <Text style={styles.headlineLabel}>this game</Text>
        </View>

        <View style={styles.statsRow}>
          <Cell label="CORRECT" value={`${s.correct}/${s.total}`} />
          <Cell label="ACCURACY" value={formatAccuracy(sessionAccuracy)} />
          <Cell label="AVG TIME" value={sessionAvg === null ? "—" : formatSolve(sessionAvg)} />
        </View>

        {versus && (
          <View style={[styles.versus, versus.result === "win" ? styles.versusWin : versus.result === "loss" ? styles.versusLoss : styles.versusTie]}>
            <Text style={styles.versusVerdict}>
              {versus.result === "win"
                ? `🏆 You beat ${rivalName}`
                : versus.result === "loss"
                  ? `😤 ${rivalName} beat you`
                  : `🤝 Dead even with ${rivalName}`}
            </Text>
            <Text style={styles.versusLine}>
              You {sessionRating!.toFixed(1)}★ · {rivalName} {challenger!.rating.toFixed(1)}★
              {versus.result !== "tie" ? `  (by ${versus.diff.toFixed(1)})` : ""}
            </Text>
            {recordLine && <Text style={styles.versusRecord}>{recordLine}</Text>}
          </View>
        )}

        {isCreate && (
          <View style={styles.versus}>
            <Text style={styles.versusVerdict}>📨 Challenge ready</Text>
            <Text style={styles.versusLine}>Share the code below so a friend can play these same {challenge!.hands} hands.</Text>
          </View>
        )}

        {mode === "daily" && (
          <View style={styles.percentile}>
            {pct === "loading" ? (
              <Text style={styles.percentileText}>Ranking you against today's players…</Text>
            ) : pct === null ? (
              <Text style={styles.percentileText}>Couldn't reach the leaderboard — you're offline.</Text>
            ) : pct.fieldSize <= 1 ? (
              <Text style={styles.percentileBig}>🏁 First to finish today's challenge</Text>
            ) : (
              <Text style={styles.percentileBig}>
                🏅 You beat {pct.percentile}% of today's {pct.fieldSize} players
              </Text>
            )}
          </View>
        )}

        {streakMsg && (
          <View
            style={[styles.streakCard, dailyStreak!.event.earnedFreeze && styles.streakCardWin]}
            accessibilityLabel="streak"
          >
            <Text style={styles.streakMsg}>{streakMsg}</Text>
            {dailyStreak!.freezes > 0 && (
              <Text style={styles.streakShields}>
                {"❄️".repeat(dailyStreak!.freezes)} {dailyStreak!.freezes} freeze{dailyStreak!.freezes === 1 ? "" : "s"} banked
              </Text>
            )}
          </View>
        )}

        {/* All-time rating: previous → Δ → new. */}
        <Text style={styles.section}>ALL-TIME RATING · {variantLabel(variant)}</Text>
        {allTimeUnlocked ? (
          <View style={styles.deltaRow}>
            <Text style={styles.deltaPrev}>{formatRating(prevRollup.rating)}</Text>
            <Text style={styles.arrow}>→</Text>
            <Text style={styles.deltaNew}>{formatRating(newRollup.rating)}</Text>
            {delta !== null && Math.abs(delta) >= 0.005 && (
              <Text style={[styles.deltaTag, delta >= 0 ? styles.deltaUp : styles.deltaDown]}>
                {delta >= 0 ? "▲" : "▼"} {Math.abs(delta).toFixed(2)}
              </Text>
            )}
          </View>
        ) : (
          <Text style={styles.locked}>Play {ALLTIME_GATE - newRollup.count} more hand{ALLTIME_GATE - newRollup.count === 1 ? "" : "s"} to unlock your rating.</Text>
        )}

        <Text style={styles.section}>THIS WEEK ({formatCloses(msUntilWeeklyReset(Date.now()))})</Text>
        {weeklyUnlocked ? (
          <View style={styles.weeklyRow}>
            <RatingStars value={weekly.rating} size={18} />
            <Text style={styles.weeklyNum}>{formatRating(weekly.rating)}</Text>
            <Text style={styles.weeklyMeta}>
              {formatAccuracy(weekly.accuracy)} · {weekly.avgTimeMs === null ? "—" : formatSolve(weekly.avgTimeMs)}
            </Text>
          </View>
        ) : (
          <Text style={styles.locked}>Not enough hands this week yet.</Text>
        )}

        {mode === "daily" && (
          <>
            <Text style={styles.section}>YOUR CARD</Text>
            <ShareCard
              data={{
                date: dayKey,
                rating: sessionRating,
                solved: s.correct,
                total: s.total,
                totalTimeSec: s.timeSumCorrect > 0 ? Math.round(s.timeSumCorrect / 1000) : null,
                accuracy: sessionAccuracy,
                streak: dailyStreak?.current,
                percentile: typeof pct === "object" && pct ? pct.percentile : null,
              }}
            />
          </>
        )}

        <View style={styles.actions}>
          {mode === "daily" ? (
            <Tappable style={[styles.btn, styles.primary]} onPress={onShare}>
              <Text style={styles.primaryText}>Share result</Text>
            </Tappable>
          ) : isCreate ? (
            <Tappable style={[styles.btn, styles.primary]} onPress={onShareChallenge}>
              <Text style={styles.primaryText}>Share challenge code</Text>
            </Tappable>
          ) : isAccept && onRematch ? (
            <Tappable style={[styles.btn, styles.primary]} onPress={onRematch}>
              <Text style={styles.primaryText}>Challenge them back</Text>
            </Tappable>
          ) : mode === "challenge" ? null : (
            <Tappable style={[styles.btn, styles.primary]} onPress={onPlayAgain}>
              <Text style={styles.primaryText}>Play again</Text>
            </Tappable>
          )}
          <Tappable style={[styles.btn, styles.secondary]} onPress={onHome}>
            <Text style={styles.secondaryText}>Back to home</Text>
          </Tappable>
          {mode === "daily" && <Text style={styles.tomorrow}>Try again tomorrow</Text>}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.cell}>
      <Text style={styles.cellLabel}>{label}</Text>
      <Text style={styles.cellValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { flexGrow: 1, justifyContent: "center", paddingHorizontal: 24, paddingVertical: 24 },
  kicker: { fontFamily: fonts.sans, fontSize: 12, letterSpacing: 1.4, color: colors.inkFaint, textAlign: "center" },
  tomorrow: { fontFamily: fonts.sans, fontSize: 13, color: colors.inkFaint, textAlign: "center", marginTop: 4 },
  headline: { alignItems: "center", marginTop: 22, marginBottom: 22 },
  headlineNum: { fontFamily: fonts.serifBold, fontSize: 44, color: colors.accent, marginTop: 8 },
  headlineLabel: { fontFamily: fonts.sans, fontSize: 12, letterSpacing: 1, color: colors.inkFaint },
  statsRow: { flexDirection: "row", gap: 10 },
  cell: { flex: 1, backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, paddingVertical: 12, alignItems: "center", ...shadows.soft },
  cellLabel: { fontFamily: fonts.sans, fontSize: 10, letterSpacing: 1, color: colors.inkFaint },
  cellValue: { fontFamily: fonts.serifBold, fontSize: 20, color: colors.ink, marginTop: 3 },
  versus: { marginTop: 14, padding: 14, borderRadius: radius.md, backgroundColor: colors.panel2, borderWidth: 1, borderColor: colors.line, alignItems: "center", gap: 4 },
  versusWin: { borderColor: colors.good },
  versusLoss: { borderColor: colors.bad },
  versusTie: { borderColor: colors.line2 },
  versusVerdict: { fontFamily: fonts.serifBold, fontSize: 17, color: colors.ink, textAlign: "center" },
  versusLine: { fontFamily: fonts.sans, fontSize: 13, color: colors.inkDim, textAlign: "center" },
  versusRecord: { fontFamily: fonts.serifSemibold, fontSize: 13, color: colors.accent, textAlign: "center", marginTop: 2 },
  streakCard: { marginTop: 12, padding: 12, borderRadius: radius.md, backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.line2, alignItems: "center", gap: 3, ...shadows.soft },
  streakCardWin: { borderColor: colors.accent },
  streakMsg: { fontFamily: fonts.serifSemibold, fontSize: 15, color: colors.ink, textAlign: "center" },
  streakShields: { fontFamily: fonts.sans, fontSize: 12, color: colors.inkDim },
  percentile: { marginTop: 14, padding: 12, borderRadius: radius.md, backgroundColor: colors.panel2, borderWidth: 1, borderColor: colors.line },
  percentileText: { fontFamily: fonts.sans, fontSize: 12, color: colors.inkDim, textAlign: "center" },
  percentileBig: { fontFamily: fonts.serifBold, fontSize: 15, color: colors.accent, textAlign: "center" },
  section: { fontFamily: fonts.sans, fontSize: 11, letterSpacing: 1.4, color: colors.inkFaint, marginTop: 26, marginBottom: 10 },
  deltaRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  deltaPrev: { fontFamily: fonts.serif, fontSize: 22, color: colors.inkDim }, // dimmed prior rating — regular weight
  arrow: { fontFamily: fonts.sans, fontSize: 18, color: colors.inkFaint },
  deltaNew: { fontFamily: fonts.serifBold, fontSize: 30, color: colors.ink },
  deltaTag: { fontFamily: fonts.sans, fontSize: 14, fontWeight: "600" },
  deltaUp: { color: colors.good },
  deltaDown: { color: colors.bad },
  weeklyRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  weeklyNum: { fontFamily: fonts.serifBold, fontSize: 22, color: colors.ink },
  weeklyMeta: { fontFamily: fonts.sans, fontSize: 13, color: colors.inkDim },
  locked: { fontFamily: fonts.sans, fontSize: 13, color: colors.inkFaint, fontStyle: "italic" },
  actions: { marginTop: 36, gap: 12 },
  btn: { paddingVertical: 16, borderRadius: radius.md, alignItems: "center" },
  primary: { backgroundColor: colors.accent, ...shadows.accent },
  primaryText: { fontFamily: fonts.serifBold, fontSize: 17, color: colors.accentInk },
  secondary: { backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.line2, ...shadows.soft },
  secondaryText: { fontFamily: fonts.serifSemibold, fontSize: 16, color: colors.ink },
});
