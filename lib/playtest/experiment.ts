import type { AgentProfile, ProviderConnection } from '../agents/types.ts';
import { createGame } from '../game/engine.ts';
import { engineRegistration } from '../game/registry.ts';
import type { GameState, Mission, RuleConfig } from '../game/types.ts';
export interface ExperimentConfig {
  ordersToWin?: 2 | 3;
  foodLimitOverride?: 0;
  randomMode: 'random' | 'fixed';
  missionMode: 'fair' | 'mixed' | 'rotation';
  pattern: Mission['pattern'];
  firstPlayer: 'random' | number;
  turnDirection: 'clockwise' | 'counterclockwise' | 'random';
  seed: number;
  memoryBudgetChars: number;
}
export const DEFAULT_EXPERIMENT: ExperimentConfig = {
  randomMode: 'random',
  missionMode: 'fair',
  pattern: '2+1+1',
  firstPlayer: 'random',
  turnDirection: 'random',
  seed: 20260905,
  memoryBudgetChars: 16000,
};
export interface ExperimentSnapshot extends ExperimentConfig {
  batchId: string;
  batchSeed: number;
  gameIndex: number;
  plannedGames: number;
}
export interface ExperimentPreset {
  id: string;
  name: string;
  config: ExperimentConfig;
  count: number;
  chat: boolean;
  maxCalls: number;
  seats: Array<{
    enabled: boolean;
    profile: AgentProfile;
    connection: Omit<ProviderConnection, 'apiKey'>;
  }>;
}
export function freshSeed() {
  return crypto.getRandomValues(new Uint32Array(1))[0];
}
export function configuredGame(
  names: string[],
  seed: number,
  config: RuleConfig,
  version: string,
  experiment?: ExperimentSnapshot,
): GameState {
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff)
    throw new Error('种子须为 0–4294967295 的整数');
  return createGame(
    names,
    seed,
    {
      ...config,
      ordersToWin: experiment?.ordersToWin ?? config.ordersToWin ?? 3,
      foodLimit: experiment?.foodLimitOverride ?? config.foodLimit,
    },
    version,
  );
}
export function connectionFingerprint(connection: ProviderConnection) {
  const base =
    connection.kind === 'openai'
      ? 'https://api.openai.com/v1'
      : connection.kind === 'anthropic'
        ? 'https://api.anthropic.com/v1'
        : connection.baseUrl?.trim().replace(/\/+$/, '');
  return `${connection.kind}|${base || ''}`;
}

// Normalize only the experiment request; historical saved states never pass here on resume.
export function normalizeExperiment<T extends ExperimentConfig>(
  config: RuleConfig,
  experiment: T,
): T {
  engineRegistration(config);
  return {
    ...experiment,
    missionMode: 'fair',
    pattern: '2+1+1',
    firstPlayer: 'random',
    turnDirection: 'clockwise',
    ordersToWin: experiment.ordersToWin ?? config.ordersToWin ?? 3,
  };
}
