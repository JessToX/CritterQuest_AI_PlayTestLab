import type { GameRecord, Seat } from '@/lib/playtest/types';

export type ResumePrompt = {
  game: GameRecord;
  seats: Seat[];
  summary?: true;
  playerId?: string;
  confirm: (seats: Seat[]) => void;
} | null;
