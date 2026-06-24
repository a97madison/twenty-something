/**
 * Firestore document shapes, server-side. These mirror the data model we
 * sketched (rooms, dailyPuzzles, users). Kept separate from @core, which knows
 * nothing about persistence.
 */

import type { Operation, Variant } from "@twenty-something/core";

export interface DailyPuzzleDoc {
  date: string; // "YYYY-MM-DD"
  variant: Variant;
  cards: { id: string; value: number }[];
  target: number;
  operations: Operation[];
  publishedAt: FirebaseFirestore.Timestamp; // when the puzzle went live
}

export interface UserDoc {
  displayName: string;
  currentStreak: number;
  maxStreak: number;
  lastPlayedDate: string | null; // "YYYY-MM-DD" of last SOLVED daily
  totalSolved: number;
}

export interface DailyResultDoc {
  date: string;
  solved: boolean;
  solveTimeSec: number;
  attempts: number;
  expression: string; // human-readable, stored after verification
  completedAt: FirebaseFirestore.Timestamp;
}

export interface RoomDoc {
  status: "lobby" | "in_progress" | "finished";
  hostId: string;
  config: {
    winningScore: number;
    [k: string]: unknown;
  };
}

export interface RoomRoundDoc {
  roundNumber: number;
  cards: { id: string; value: number }[];
  target: number;
  operations: Operation[];
  status: "racing" | "solved" | "expired";
  startedAt: FirebaseFirestore.Timestamp;
  endsAt: FirebaseFirestore.Timestamp | null;
  winnerId: string | null;
}
