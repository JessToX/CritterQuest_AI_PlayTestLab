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
export type DeletableRecordKind = 'game' | 'memory' | 'preset';
