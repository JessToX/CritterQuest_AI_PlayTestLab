import type { GameRecord, Seat } from '@/lib/playtest/types';

export type ResumePrompt = { game: GameRecord; seats: Seat[] } | null;
