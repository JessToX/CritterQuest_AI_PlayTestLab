import { UNSUPPORTED_RELEASE_VERSION } from '../game/registry.ts';
import { isOfficialGame, isOfficialRule } from '../rules/scope.ts';
import type { MemoryEntry } from '../memory/types.ts';
import type { RuleVersion } from '../rules/types.ts';
import {
  connectionFingerprint,
  freshSeed,
  normalizeExperiment,
  type ExperimentConfig,
} from './experiment.ts';
import { newRecord } from './record.ts';
import { runGame } from './run-game.ts';
import type { RunOptions } from './runtime.ts';
import type { CallModel, GameRecord, Seat } from './types.ts';

export interface BatchRecord {
  id: string;
  config: ExperimentConfig;
  batchSeed: number;
  plannedGames: number;
  gameIds: string[];
  status: string;
}

interface BatchPlanInput {
  resume?: GameRecord;
  experiment: ExperimentConfig;
  count: number;
  batchId?: string;
}

export function createBatchPlan({
  resume,
  experiment,
  count,
  batchId = crypto.randomUUID(),
}: BatchPlanInput) {
  const batchSeed =
    resume?.experiment?.batchSeed ??
    (experiment.randomMode === 'random' ? freshSeed() : experiment.seed);
  const plannedGames = resume ? 1 : count;
  return {
    batchSeed,
    plannedGames,
    batch: {
      id: batchId,
      config: experiment,
      batchSeed,
      plannedGames,
      gameIds: [] as string[],
      status: 'running',
    } satisfies BatchRecord,
  };
}

interface RunBatchOptions {
  mode: GameRecord['mode'];
  resume?: GameRecord;
  seats: Seat[];
  rule: RuleVersion;
  experiment: ExperimentConfig;
  count: number;
  maxCalls: number;
  chat: boolean;
  memories: MemoryEntry[];
  signal: AbortSignal;
  call: CallModel;
  reserveCall?: RunOptions['reserveCall'];
  saveExperiment: (record: BatchRecord) => Promise<void>;
  persistGame: (record: GameRecord) => Promise<void>;
  persistMemory: (entry: MemoryEntry) => Promise<void>;
  onCurrent: (record: GameRecord) => void;
  onGame: (record: GameRecord) => void;
  onMessage: (message: string) => void;
  onTerminated: (record: GameRecord) => Promise<void>;
}

export async function runBatch(options: RunBatchOptions) {
  if (
    options.resume
      ? !isOfficialGame(options.resume)
      : !isOfficialRule(options.rule)
  )
    throw new Error(UNSUPPORTED_RELEASE_VERSION);
  const {
    mode,
    resume,
    seats,
    rule,
    experiment: requestedExperiment,
    count,
    maxCalls,
    chat,
    memories,
    signal,
  } = options;
  const experiment = normalizeExperiment(rule.config, requestedExperiment);
  const { batchSeed, plannedGames, batch } = createBatchPlan({
    resume,
    experiment,
    count,
  });
  if (!resume) await options.saveExperiment(batch);

  for (let index = 0; index < plannedGames; index++) {
    if (signal.aborted) break;
    const record = resume
      ? {
          ...resume,
          seats:
            mode === 'simulation'
              ? resume.seats
              : resume.seats.map((saved, seatIndex) => ({
                  ...saved,
                  connection: {
                    id: seats[seatIndex].connection.id,
                    label: seats[seatIndex].connection.label,
                    kind: seats[seatIndex].connection.kind,
                    baseUrl: seats[seatIndex].connection.baseUrl,
                  },
                  connectionFingerprint: connectionFingerprint(
                    seats[seatIndex].connection,
                  ),
                })),
        }
      : newRecord(seats, rule, (batchSeed + index) >>> 0, mode, {
          ...experiment,
          batchId: batch.id,
          batchSeed,
          plannedGames,
          gameIndex: index,
        });
    if (!resume) {
      batch.gameIds.push(record.id);
      await options.saveExperiment(batch);
    }
    options.onMessage(
      `${mode === 'simulation' ? '模拟检查' : 'API 对战'}：第 ${index + 1} / ${plannedGames} 局；关闭页面会停止。`,
    );
    const result = await runGame(record, seats, memories, {
      call: options.call,
      reserveCall: options.reserveCall,
      signal,
      maxCalls:
        mode === 'simulation' && resume
          ? Math.max(maxCalls, resume.runtime?.maxCalls || 0)
          : maxCalls,
      chat: resume?.runtime?.chat ?? chat,
      save: options.persistGame,
      onUpdate: options.onCurrent,
      saveMemory: options.persistMemory,
    });
    options.onGame(result);
    if (result.status === 'terminated') await options.onTerminated(result);
    if (!resume) {
      batch.status =
        result.status === 'complete' && index === plannedGames - 1
          ? 'complete'
          : result.status === 'complete'
            ? 'running'
            : result.status;
      await options.saveExperiment(batch);
    }
    if (result.status !== 'complete') {
      options.onMessage(result.error || '已暂停');
      break;
    }
    const failed =
      result.summaryJobs?.filter((job) => job.status !== 'complete').length ||
      0;
    options.onMessage(
      `已完成 ${index + 1} 局，对局与报告已保存。${
        failed ? `${failed} 份总结未完成，可单独补生成。` : '反思已保存。'
      }`,
    );
  }
}
