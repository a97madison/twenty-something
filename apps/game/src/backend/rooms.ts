/**
 * Client for the live-rooms callables — auth'd REST, same `{ data }` → `{ result }`
 * wire format as daily.ts. Throws on a callable error so the screen can show it;
 * callers wrap network/offline failures themselves.
 */
import type { Variant } from "@twenty-something/core";
import type { KeyValueStore } from "../logic";
import { fnUrl } from "./config";
import { getIdToken } from "./auth";

async function callFn(store: KeyValueStore, name: string, data: unknown): Promise<any> {
  const idToken = await getIdToken(store);
  const r = await fetch(fnUrl(name), {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
    body: JSON.stringify({ data }),
  });
  const j = await r.json();
  if (j?.error) throw new Error(j.error.message ?? "request failed");
  return j?.result ?? null;
}

export interface RoomRound {
  roundNumber: number;
  cards: { id: string; value: number }[];
  target: number;
  status: "racing" | "solved" | "expired";
  winnerId: string | null;
  endsAt: number | null;
}

export interface RoomState {
  status: "lobby" | "ready_up" | "in_progress" | "finished";
  variant: Variant;
  hostId: string;
  winningScore: number | null;
  players: { uid: string; score: number; ready: boolean }[];
  round: RoomRound | null;
}

export const createRoom = (store: KeyValueStore, variant: Variant, winningScore: number) =>
  callFn(store, "createRoom", { variant, winningScore }) as Promise<{ roomId: string; variant: Variant; winningScore: number }>;

export const joinRoom = (store: KeyValueStore, roomId: string) =>
  callFn(store, "joinRoom", { roomId }) as Promise<{ roomId: string; variant: Variant; winningScore: number; status: string }>;

export const startMatch = (store: KeyValueStore, roomId: string) =>
  callFn(store, "startMatch", { roomId }) as Promise<{ ok: boolean }>;

export const readyUp = (store: KeyValueStore, roomId: string) =>
  callFn(store, "readyUp", { roomId }) as Promise<{ ok: boolean }>;

export const dealRoomRound = (store: KeyValueStore, roomId: string, roundNumber: number, durationSec?: number) =>
  callFn(store, "dealRoomRound", { roomId, roundNumber, durationSec }) as Promise<RoomRound>;

export const getRoomState = (store: KeyValueStore, roomId: string) =>
  callFn(store, "getRoomState", { roomId }) as Promise<RoomState>;

export const submitRoomSolution = (store: KeyValueStore, roomId: string, roundNumber: number, expr: unknown) =>
  callFn(store, "submitRoomSolution", { roomId, roundNumber, expr }) as Promise<{ won: boolean; matchWon?: boolean; score?: number; reason?: string }>;
