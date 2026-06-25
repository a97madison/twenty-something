import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import type { Variant } from "@twenty-something/core";
import { colors, useAppFonts } from "@twenty-something/ui";

import {
  dealHands,
  dealDailyHands,
  dealSeededHands,
  randomSeed,
  loadStats,
  saveStats,
  loadDailyDone,
  saveDailyDone,
  isDailyDone,
  emptyStats,
  DAILY_HANDS,
  type AllStats,
  type Challenge,
  type DealtHand,
  type GameState,
} from "./logic";
import { storage } from "./storage";
import { localDayKey } from "./screens/format";
import { HomeScreen } from "./screens/HomeScreen";
import { SetupScreen } from "./screens/SetupScreen";
import { ChallengeScreen } from "./screens/ChallengeScreen";
import { GameScreen } from "./screens/GameScreen";
import { SummaryScreen } from "./screens/SummaryScreen";
import { StatsScreen } from "./screens/StatsScreen";
import { InstructionsScreen } from "./screens/InstructionsScreen";

type Screen = "home" | "setup" | "challenge" | "game" | "summary" | "stats" | "instructions";
type Mode = "practice" | "daily" | "challenge";

/** Everything a friend-challenge game needs beyond its dealt hands. */
interface ChallengeContext {
  role: "create" | "accept";
  /** The deal seed — shared in the code so the friend gets identical hands. */
  seed: string;
  hands: number;
  /** create: the player's name to stamp into the shared code. */
  myName?: string;
  /** accept: who sent the challenge and how they scored, for the head-to-head. */
  challenger?: { name: string; rating: number };
}

/** AsyncStorage key for the remembered challenger name. */
const NAME_KEY = "twenty-something:challenger-name";

/** What it takes to (re)start a game: the variant, the dealt deck, and the mode. */
interface GameConfig {
  variant: Variant;
  hands: DealtHand[];
  mode: Mode;
  /** Practice hand count, kept so "Play again" can re-deal the same size. */
  count: number;
  /** Present only for friend challenges. */
  challenge?: ChallengeContext;
}

/** Frozen snapshot needed to render the summary after a game ends. */
interface SummaryData {
  variant: Variant;
  mode: Mode;
  previousStats: AllStats;
  finalState: GameState;
  dayKey: string;
  challenge?: ChallengeContext;
}

export default function App() {
  const [screen, setScreen] = useState<Screen>("home");
  const [stats, setStats] = useState<AllStats>(() => emptyStats());
  const [config, setConfig] = useState<GameConfig | null>(null);
  const [summary, setSummary] = useState<SummaryData | null>(null);
  // Stats captured the instant a game starts, for the summary's previous→new delta.
  const [startStats, setStartStats] = useState<AllStats>(() => emptyStats());
  // Bumped per game so each GameScreen mounts fresh with its own deck.
  const [gameNonce, setGameNonce] = useState(0);
  // dayKey of the last completed daily — gates the daily to one attempt per day.
  const [dailyDoneKey, setDailyDoneKey] = useState<string | null>(null);
  // Remembered display name for friend challenges.
  const [challengerName, setChallengerName] = useState<string>("");

  // Load saved stats + daily-done marker + remembered name once on mount.
  useEffect(() => {
    let alive = true;
    loadStats(storage).then((s) => {
      if (alive) setStats(s);
    });
    loadDailyDone(storage).then((k) => {
      if (alive) setDailyDoneKey(k);
    });
    storage.getItem(NAME_KEY).then((n) => {
      if (alive && n) setChallengerName(n);
    });
    return () => {
      alive = false;
    };
  }, []);

  const persist = (s: AllStats) => {
    setStats(s);
    saveStats(storage, s).catch(() => {});
  };

  const launch = (cfg: GameConfig) => {
    setConfig(cfg);
    setStartStats(stats);
    setGameNonce((n) => n + 1);
    setScreen("game");
  };

  const startPractice = (variant: Variant, count: number) => {
    launch({ variant, hands: dealHands(variant, count), mode: "practice", count });
  };

  const startDaily = () => {
    if (isDailyDone(dailyDoneKey, localDayKey())) return; // one attempt per day
    const variant: Variant = "24";
    launch({ variant, hands: dealDailyHands(variant, localDayKey()), mode: "daily", count: DAILY_HANDS });
  };

  // Create a fresh challenge: deal from a new random seed, remember the name, play.
  const startChallengeCreate = (variant: Variant, hands: number, name: string) => {
    const seed = randomSeed();
    setChallengerName(name);
    storage.setItem(NAME_KEY, name).catch(() => {});
    launch({
      variant,
      hands: dealSeededHands(seed, variant, hands),
      mode: "challenge",
      count: hands,
      challenge: { role: "create", seed, hands, myName: name },
    });
  };

  // Accept a pasted challenge: re-deal its exact hands, play head-to-head.
  const startChallengeAccept = (c: Challenge) => {
    launch({
      variant: c.variant,
      hands: dealSeededHands(c.seed, c.variant, c.hands),
      mode: "challenge",
      count: c.hands,
      challenge: { role: "accept", seed: c.seed, hands: c.hands, challenger: { name: c.name, rating: c.rating } },
    });
  };

  const finishGame = (finalState: GameState) => {
    if (!config) return;
    const today = localDayKey();
    if (config.mode === "daily") {
      saveDailyDone(storage, today).catch(() => {});
      setDailyDoneKey(today);
    }
    setSummary({
      variant: config.variant,
      mode: config.mode,
      previousStats: startStats,
      finalState,
      dayKey: today,
      challenge: config.challenge,
    });
    setScreen("summary");
  };

  const playAgain = () => {
    if (!config) return setScreen("home");
    if (config.mode === "daily") startDaily();
    else if (config.mode === "challenge") setScreen("home"); // each challenge is a fixed deck
    else startPractice(config.variant, config.count);
  };

  const [fontsLoaded] = useAppFonts();
  if (!fontsLoaded) return null; // hold first paint until the bundled fonts are ready

  return (
    <SafeAreaProvider>
      <View style={styles.root}>
        <StatusBar style="dark" />
        {screen === "home" && (
          <HomeScreen
            onPlay={() => setScreen("setup")}
            onDaily={startDaily}
            onChallenge={() => setScreen("challenge")}
            onStats={() => setScreen("stats")}
            onInstructions={() => setScreen("instructions")}
            dailyDone={isDailyDone(dailyDoneKey, localDayKey())}
          />
        )}
        {screen === "setup" && <SetupScreen onStart={startPractice} onBack={() => setScreen("home")} />}
        {screen === "challenge" && (
          <ChallengeScreen
            defaultName={challengerName}
            onCreate={startChallengeCreate}
            onAccept={startChallengeAccept}
            onBack={() => setScreen("home")}
          />
        )}
        {screen === "game" && config && (
          <GameScreen
            key={gameNonce}
            variant={config.variant}
            hands={config.hands}
            initialStats={stats}
            mode={config.mode}
            onDone={finishGame}
            onStats={persist}
            dayKey={localDayKey}
          />
        )}
        {screen === "summary" && summary && (
          <SummaryScreen
            variant={summary.variant}
            mode={summary.mode}
            previousStats={summary.previousStats}
            finalState={summary.finalState}
            dayKey={summary.dayKey}
            challenge={summary.challenge}
            onPlayAgain={playAgain}
            onHome={() => setScreen("home")}
          />
        )}
        {screen === "stats" && <StatsScreen stats={stats} dayKey={localDayKey()} onBack={() => setScreen("home")} />}
        {screen === "instructions" && <InstructionsScreen onBack={() => setScreen("home")} />}
      </View>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
});
