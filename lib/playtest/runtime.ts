import type { MemoryEntry } from '../memory/types.ts';
import type { CallModel, GameRecord, Seat } from './types.ts';
export type RunOptions = {
  call: CallModel;
  reserveCall?: (
    gameId: string,
    limit: number,
    previous: number,
    signal: AbortSignal,
  ) => Promise<number>;
  save: (record: GameRecord) => Promise<void>;
  saveMemory: (entry: MemoryEntry) => Promise<void>;
  onUpdate: (record: GameRecord) => void;
  signal: AbortSignal;
  maxCalls: number;
  chat: boolean;
  summaryOnly?: boolean;
  summaryTarget?: {
    kind: 'checkpoint' | 'reflection';
    round: number;
    playerId?: string;
  };
  retryDelayMs?: number;
};
export interface RuntimeContext {
  r: GameRecord;
  seats: Seat[];
  entries: MemoryEntry[];
  options: RunOptions;
  publish: () => Promise<void>;
}
export type ModelCaller = (
  index: number,
  task: string,
  input: unknown,
  attempts?: number,
) => Promise<Record<string, unknown>>;
