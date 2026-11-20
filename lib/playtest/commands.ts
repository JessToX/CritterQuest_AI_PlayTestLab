import type { GameRecord, Seat } from './types.ts';

export type StartPlaytest = (
  mode: GameRecord['mode'],
  resume?: GameRecord,
  suppliedSeats?: Seat[],
) => Promise<void>;

export type RepairSummaries = (
  game: GameRecord,
  target?: {
    kind: 'checkpoint' | 'reflection';
    round: number;
    playerId?: string;
  },
) => Promise<void>;
