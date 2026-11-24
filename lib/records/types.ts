import type { MemoryEntry } from '../memory/types.ts';
import type {
  ExperimentConfig,
  ExperimentPreset,
} from '../playtest/experiment.ts';
import type { GameRecord, Seat } from '../playtest/types.ts';
import type { RuleVersion } from '../rules/types.ts';
export interface ExperimentRecord {
  id: string;
  config: ExperimentConfig;
  batchSeed: number;
  plannedGames: number;
  gameIds: string[];
  status: string;
}
export interface RecordTypes {
  game: GameRecord;
  memory: MemoryEntry;
  rule: RuleVersion;
  profiles: { seats: Seat[] };
  preset: ExperimentPreset;
  experiment: ExperimentRecord;
}
export type RecordKind = keyof RecordTypes;
// The SQL limit, HTTP hasMore flag and browser offset advance use the same unit.
export const RECORD_PAGE_SIZE = 20;

const deletable = {
  game: true,
  memory: true,
  rule: false,
  profiles: false,
  preset: true,
  experiment: false,
} as const satisfies Record<RecordKind, boolean>;

export type DeletableRecordKind = {
  [K in RecordKind]: (typeof deletable)[K] extends true ? K : never;
}[RecordKind];

export function isRecordKind(value: unknown): value is RecordKind {
  return typeof value === 'string' && Object.hasOwn(deletable, value);
}

export function isDeletableRecordKind(
  value: unknown,
): value is DeletableRecordKind {
  return isRecordKind(value) && deletable[value];
}
