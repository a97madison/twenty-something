import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Keyboard, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import type { Variant } from "@twenty-something/core";
import {
  CalcPad,
  colors,
  fonts,
  radius,
  shadows,
  Tappable,
  parseTokens,
  fillValues,
  type CheckerToken,
  type CardToken,
  type CalcPadFeedback,
  type SuitData,
} from "@twenty-something/ui";

import { storage } from "../storage";
import { getUid } from "../backend/auth";
import { createRoom, joinRoom, startMatch, readyUp, dealRoomRound, getRoomState, submitRoomSolution, type RoomState } from "../backend/rooms";
import { variantLabel, tokenStr } from "./format";

const SUITS: SuitData[] = [
  { s: "♠", red: false },
  { s: "♥", red: true },
  { s: "♦", red: true },
  { s: "♣", red: false },
];
/** How often we poll the room for live state. */
const POLL_MS = 1500;
/** Rounds to win the match. */
const WINNING_SCORE = 3;

type Phase = "entry" | "lobby" | "ready" | "race" | "done";

function expectsOperand(tokens: CheckerToken[]): boolean {
  const last = tokens[tokens.length - 1];
  return !last || last.type === "op" || last.type === "lp";
}
function openParens(tokens: CheckerToken[]): number {
  let d = 0;
  for (const t of tokens) d += t.type === "lp" ? 1 : t.type === "rp" ? -1 : 0;
  return d;
}

interface Props {
  variant: Variant;
  onBack: () => void;
}

/**
 * Live head-to-head rooms: create or join by code, then race the SAME hand —
 * first valid solve wins the round, first to {WINNING_SCORE} wins the match. The
 * server is the authority (submitRoomSolution); the client polls getRoomState for
 * live scores + round status. (Rounds are always solvable, so CalcPad's
 * No-solution / Pass keys are inert here — a future pad variant can hide them.)
 */
export function RoomsScreen({ variant: initialVariant, onBack }: Props) {
  const [phase, setPhase] = useState<Phase>("entry");
  // Within the entry phase: a hub → create-setup / join-by-code.
  const [entryView, setEntryView] = useState<"hub" | "create" | "join">("hub");
  const [variant, setVariant] = useState<Variant>(initialVariant);
  const [winningScore, setWinningScore] = useState(WINNING_SCORE);
  const [roomId, setRoomId] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [uid, setUid] = useState("");
  const [state, setState] = useState<RoomState | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tokens, setTokens] = useState<CheckerToken[]>([]);
  const [feedback, setFeedback] = useState<CalcPadFeedback | null>(null);
  const lastRound = useRef(0);

  useEffect(() => {
    getUid(storage).then(setUid).catch(() => {});
  }, []);

  // Poll live room state while in the lobby, ready-up, or a race.
  useEffect(() => {
    if (!["lobby", "ready", "race"].includes(phase) || !roomId) return;
    let alive = true;
    const tick = async () => {
      try {
        const s = await getRoomState(storage, roomId);
        if (!alive) return;
        setState(s);
        setVariant(s.variant);
        if (s.status === "finished") setPhase("done");
        else if (s.status === "in_progress" && s.round) {
          setPhase("race");
          if (s.round.roundNumber !== lastRound.current) {
            lastRound.current = s.round.roundNumber; // fresh round → clear the pad
            setTokens([]);
            setFeedback(null);
          }
        } else if (s.status === "ready_up") {
          setPhase("ready");
        }
      } catch {
        /* transient — next tick retries */
      }
    };
    tick();
    const id = setInterval(tick, POLL_MS);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [phase, roomId]);

  const doCreate = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await createRoom(storage, variant, winningScore);
      setRoomId(r.roomId);
      setPhase("lobby");
    } catch {
      setError("Couldn't create a room — check your connection.");
    } finally {
      setBusy(false);
    }
  };

  const doJoin = async () => {
    Keyboard.dismiss();
    const code = joinCode.trim().toUpperCase();
    if (code.length < 4) {
      setError("Enter the 4-letter room code.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const r = await joinRoom(storage, code);
      setRoomId(r.roomId);
      setVariant(r.variant);
      setPhase("lobby");
    } catch {
      setError("That room couldn't be found.");
    } finally {
      setBusy(false);
    }
  };

  const isHost = state?.hostId === uid && uid !== "";

  // N-player derived state (no per-player labels — counts + your/top score).
  const players = state?.players ?? [];
  const playerCount = players.length;
  const myReady = players.find((p) => p.uid === uid)?.ready ?? false;
  const readyCount = players.filter((p) => p.ready).length;
  const allReady = playerCount > 0 && readyCount === playerCount;
  const myScore = players.find((p) => p.uid === uid)?.score ?? 0;
  const topScore = players.reduce((m, p) => Math.max(m, p.score), 0);

  const doStart = async () => {
    try {
      await startMatch(storage, roomId);
    } catch {
      setError("Couldn't start the match.");
    }
  };
  const doReady = () => {
    readyUp(storage, roomId).catch(() => {});
  };

  // Host deals the first round automatically once everyone has readied up.
  const dealt = useRef(false);
  useEffect(() => {
    if (phase !== "ready") {
      dealt.current = false;
      return;
    }
    if (isHost && allReady && !dealt.current) {
      dealt.current = true;
      dealRound(1);
    }
  }, [phase, isHost, allReady]);

  const dealRound = async (roundNumber: number) => {
    try {
      await dealRoomRound(storage, roomId, roundNumber);
    } catch {
      setError("Couldn't deal the round.");
    }
  };

  const round = state?.round ?? null;
  const values = round?.cards.map((c) => c.value) ?? [];
  const usedIndices = tokens.filter((t): t is CardToken => t.type === "card").map((t) => t.i);
  const allFour = usedIndices.length === 4 && [0, 1, 2, 3].every((i) => usedIndices.includes(i));
  const racing = round?.status === "racing";
  const canSubmit = racing && parseTokens(tokens) !== null && allFour;

  const push = (t: CheckerToken) => {
    setTokens((cur) => [...cur, t]);
    setFeedback((f) => (f ? null : f));
  };

  const submit = async () => {
    if (!round || !racing) return;
    const tree = parseTokens(tokens);
    if (!tree) return;
    const expr = fillValues(tree, values);
    try {
      const res = await submitRoomSolution(storage, roomId, round.roundNumber, expr);
      if (res.won) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        setFeedback({ kind: "ok", text: res.matchWon ? "🏆 You win the match!" : "🟢 Round won!" });
        setTokens([]);
      } else if (res.reason === "round_over") {
        setFeedback({ kind: "bad", text: "Too late — someone solved it first" });
      } else if (res.reason === "wrong_value") {
        setFeedback({ kind: "bad", text: "Not the target — keep trying" });
      } else {
        setFeedback({ kind: "bad", text: "Not a valid solution" });
      }
    } catch {
      setFeedback({ kind: "bad", text: "Submit failed — connection?" });
    }
  };

  // ---- Render -------------------------------------------------------------
  const back = () => {
    setError(null);
    if (phase === "entry") return entryView === "hub" ? onBack() : setEntryView("hub");
    setPhase("entry");
    setEntryView("hub");
    setState(null);
    setRoomId("");
  };

  return (
    <SafeAreaView style={styles.safe}>
      <Tappable style={styles.back} onPress={back} hitSlop={12} accessibilityLabel="Back">
        <Text style={styles.backText}>‹ Back</Text>
      </Tappable>

      {phase === "entry" && (
        <ScrollView contentContainerStyle={styles.entry}>
          <Text style={styles.title}>Live rooms</Text>

          {entryView === "hub" && (
            <>
              <Text style={styles.blurb}>Compete against your friends!</Text>
              <Tappable style={[styles.btn, styles.primary]} onPress={() => setEntryView("create")}>
                <Text style={styles.primaryText}>Create a room</Text>
              </Tappable>
              <Tappable style={[styles.btn, styles.secondary]} onPress={() => setEntryView("join")}>
                <Text style={styles.secondaryText}>Join with a code</Text>
              </Tappable>
            </>
          )}

          {entryView === "create" && (
            <>
              <Text style={styles.label}>VARIANT</Text>
              <View style={styles.choiceRow}>
                {(["24", "20_something"] as Variant[]).map((v) => (
                  <Tappable key={v} style={[styles.choice, variant === v && styles.choiceOn]} onPress={() => setVariant(v)}>
                    <Text style={[styles.choiceText, variant === v && styles.choiceTextOn]}>{variantLabel(v)}</Text>
                  </Tappable>
                ))}
              </View>

              <Text style={styles.label}>FIRST TO</Text>
              <View style={styles.choiceRow}>
                {[3, 5, 7].map((n) => (
                  <Tappable key={n} style={[styles.choice, winningScore === n && styles.choiceOn]} onPress={() => setWinningScore(n)}>
                    <Text style={[styles.choiceText, winningScore === n && styles.choiceTextOn]}>{n}</Text>
                  </Tappable>
                ))}
              </View>

              <Text style={styles.hint}>You'll get a room code to share. First to win {winningScore} rounds takes the match.</Text>
              <Tappable style={[styles.btn, styles.primary, styles.cta]} onPress={doCreate} disabled={busy}>
                <Text style={styles.primaryText}>{busy ? "Creating…" : "Create room"}</Text>
              </Tappable>
              {error && <Text style={styles.error}>{error}</Text>}
            </>
          )}

          {entryView === "join" && (
            <>
              <Text style={styles.label}>ROOM CODE</Text>
              <TextInput
                style={styles.codeInput}
                value={joinCode}
                onChangeText={(t) => {
                  setJoinCode(t.toUpperCase());
                  if (error) setError(null);
                }}
                placeholder="ABCD"
                placeholderTextColor={colors.inkFaint}
                autoCapitalize="characters"
                autoCorrect={false}
                maxLength={6}
                returnKeyType="go"
                onSubmitEditing={doJoin}
              />
              <Text style={styles.hint}>Enter the code a friend shared to join their room.</Text>
              <Tappable style={[styles.btn, styles.primary, styles.cta]} onPress={doJoin} disabled={busy}>
                <Text style={styles.primaryText}>{busy ? "Joining…" : "Join room"}</Text>
              </Tappable>
              {error && <Text style={styles.error}>{error}</Text>}
            </>
          )}
        </ScrollView>
      )}

      {phase === "lobby" && (
        <View style={styles.lobby}>
          <Text style={styles.kicker}>ROOM CODE</Text>
          <Text style={styles.roomCode}>{roomId}</Text>
          <Text style={styles.blurb}>Share this code. {variantLabel(variant)} · first to {state?.winningScore ?? winningScore}.</Text>

          <Text style={styles.playerCount}>{playerCount}</Text>
          <Text style={styles.label}>{playerCount === 1 ? "PLAYER — SHARE THE CODE" : "PLAYERS"}</Text>

          {isHost ? (
            <Tappable style={[styles.btn, styles.primary, styles.lobbyBtn]} onPress={doStart}>
              <Text style={styles.primaryText}>Start the match</Text>
            </Tappable>
          ) : (
            <View style={styles.waiting}>
              <ActivityIndicator color={colors.accent} />
              <Text style={styles.waitingText}>Waiting for the host to start…</Text>
            </View>
          )}
          {error && <Text style={styles.error}>{error}</Text>}
        </View>
      )}

      {phase === "ready" && (
        <View style={styles.lobby}>
          <Text style={styles.title}>Ready up</Text>
          <Text style={styles.readyCount}>{readyCount} / {playerCount}</Text>
          <Text style={styles.blurb}>The match starts once everyone's ready.</Text>
          {myReady ? (
            <View style={styles.waiting}>
              <ActivityIndicator color={colors.accent} />
              <Text style={styles.waitingText}>Waiting for everyone…</Text>
            </View>
          ) : (
            <Tappable style={[styles.btn, styles.primary, styles.lobbyBtn]} onPress={doReady}>
              <Text style={styles.primaryText}>I'm ready</Text>
            </Tappable>
          )}
          {error && <Text style={styles.error}>{error}</Text>}
        </View>
      )}

      {(phase === "race" || phase === "done") && (
        <View style={styles.race}>
          <View style={styles.scoreboard}>
            <View style={[styles.scoreCell, styles.scoreMine]}>
              <Text style={styles.scoreName}>YOU</Text>
              <Text style={styles.scoreNum}>{myScore}</Text>
            </View>
            <View style={styles.scoreCell}>
              <Text style={styles.scoreName}>TOP</Text>
              <Text style={styles.scoreNum}>{topScore}</Text>
            </View>
            <View style={styles.scoreCell}>
              <Text style={styles.scoreName}>FIRST TO</Text>
              <Text style={styles.scoreNum}>{state?.winningScore ?? WINNING_SCORE}</Text>
            </View>
          </View>

          {phase === "done" ? (
            <View style={styles.done}>
              <Text style={styles.doneTitle}>{myScore >= topScore && myScore > 0 ? "🏆 You win!" : "Match over"}</Text>
              <Tappable style={[styles.btn, styles.primary]} onPress={onBack}>
                <Text style={styles.primaryText}>Back to home</Text>
              </Tappable>
            </View>
          ) : round ? (
            <View style={styles.pad}>
              {!racing && (
                <Text style={styles.roundOver}>
                  {round.winnerId === uid ? "You took that round 🟢" : "Round over"}
                  {isHost ? "" : " — waiting for the next round…"}
                </Text>
              )}
              <CalcPad
                values={values}
                suits={[0, 1, 2, 3]}
                suitData={SUITS}
                variant={variant}
                target={round.target}
                expression={tokenStr(tokens, values)}
                usedIndices={usedIndices}
                canSubmit={!!canSubmit}
                dealNonce={round.roundNumber}
                onCardPress={(i) => {
                  if (!racing || usedIndices.includes(i) || !expectsOperand(tokens)) return;
                  push({ type: "card", i });
                }}
                onOp={(op) => {
                  if (!racing || expectsOperand(tokens)) return;
                  push({ type: "op", op });
                }}
                onParen={(p) => {
                  if (!racing) return;
                  if (p === "(") {
                    if (expectsOperand(tokens)) push({ type: "lp" });
                  } else if (!expectsOperand(tokens) && openParens(tokens) > 0) push({ type: "rp" });
                }}
                onBackspace={() => setTokens((cur) => cur.slice(0, -1))}
                onEquals={submit}
                onNoSolution={() => {}}
                onPass={() => {}}
                feedback={feedback}
              />
              {isHost && !racing && (
                <Tappable style={[styles.btn, styles.primary, styles.nextBtn]} onPress={() => dealRound(round.roundNumber + 1)}>
                  <Text style={styles.primaryText}>Next round</Text>
                </Tappable>
              )}
            </View>
          ) : (
            <View style={styles.waiting}>
              <ActivityIndicator color={colors.accent} />
              <Text style={styles.waitingText}>Dealing…</Text>
            </View>
          )}
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: 18 },
  back: { paddingTop: 8, paddingBottom: 4 },
  backText: { fontFamily: fonts.sans, fontSize: 15, color: colors.inkDim },
  entry: { paddingHorizontal: 6, paddingBottom: 40 },
  title: { fontFamily: fonts.serifBold, fontSize: 30, color: colors.ink, marginTop: 10, marginBottom: 8 },
  blurb: { fontFamily: fonts.sans, fontSize: 14, lineHeight: 20, color: colors.inkDim, marginBottom: 12 },
  label: { fontFamily: fonts.sans, fontSize: 11, letterSpacing: 1.4, color: colors.inkFaint, marginTop: 18, marginBottom: 10 },
  choiceRow: { flexDirection: "row", gap: 10, marginBottom: 8 },
  choice: { flex: 1, paddingVertical: 14, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line2, backgroundColor: colors.panel, alignItems: "center" },
  choiceOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  choiceText: { fontFamily: fonts.serifSemibold, fontSize: 16, color: colors.ink },
  choiceTextOn: { color: colors.accentInk },
  btn: { paddingVertical: 16, borderRadius: radius.md, alignItems: "center", marginTop: 14 },
  primary: { backgroundColor: colors.accent, ...shadows.accent },
  primaryText: { fontFamily: fonts.serifBold, fontSize: 17, color: colors.accentInk },
  secondary: { backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.line2, ...shadows.soft },
  secondaryText: { fontFamily: fonts.serifSemibold, fontSize: 16, color: colors.ink },
  or: { fontFamily: fonts.sans, fontSize: 13, color: colors.inkFaint, textAlign: "center", marginTop: 22 },
  hint: { fontFamily: fonts.sans, fontSize: 13, color: colors.inkFaint, marginTop: 16, lineHeight: 18 },
  cta: { marginTop: 20 },
  codeInput: { fontFamily: fonts.monoMedium, fontSize: 24, letterSpacing: 6, textAlign: "center", color: colors.ink, backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.line2, borderRadius: radius.md, paddingVertical: 14, marginTop: 10 },
  error: { fontFamily: fonts.sans, fontSize: 13, color: colors.bad, marginTop: 12, textAlign: "center" },
  lobby: { flex: 1, alignItems: "center", paddingTop: 24 },
  kicker: { fontFamily: fonts.sans, fontSize: 11, letterSpacing: 1.6, color: colors.inkFaint },
  roomCode: { fontFamily: fonts.serifBold, fontSize: 56, letterSpacing: 8, color: colors.accent, marginVertical: 6 },
  playerCount: { fontFamily: fonts.serifBold, fontSize: 52, color: colors.ink, marginTop: 18 },
  readyCount: { fontFamily: fonts.serifBold, fontSize: 52, color: colors.accent, marginTop: 18 },
  lobbyBtn: { alignSelf: "stretch", marginHorizontal: 12, marginTop: 30 },
  waiting: { alignItems: "center", gap: 10, marginTop: 30 },
  waitingText: { fontFamily: fonts.sans, fontSize: 14, color: colors.inkDim },
  race: { flex: 1 },
  scoreboard: { flexDirection: "row", gap: 8, marginTop: 4, marginBottom: 8 },
  scoreCell: { flex: 1, backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, paddingVertical: 8, alignItems: "center", ...shadows.soft },
  scoreMine: { borderColor: colors.accent },
  scoreName: { fontFamily: fonts.sans, fontSize: 10, letterSpacing: 1, color: colors.inkFaint },
  scoreNum: { fontFamily: fonts.serifBold, fontSize: 22, color: colors.ink },
  pad: { flex: 1 },
  roundOver: { fontFamily: fonts.serifSemibold, fontSize: 14, color: colors.inkDim, textAlign: "center", marginBottom: 6 },
  nextBtn: { marginHorizontal: 12 },
  done: { flex: 1, alignItems: "center", justifyContent: "center", gap: 16 },
  doneTitle: { fontFamily: fonts.serifBold, fontSize: 28, color: colors.ink },
});
