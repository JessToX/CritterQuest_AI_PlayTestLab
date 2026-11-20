import {
  DEFAULT_EXPERIMENT,
  type ExperimentSnapshot,
} from '../../lib/playtest/experiment.ts';
import { newRecord } from '../../lib/playtest/record.ts';
import { simulationCall } from '../../lib/playtest/simulation.ts';
import {
  type CallModel,
  type GameRecord,
  type Seat,
} from '../../lib/playtest/types.ts';
import { BASE_RULE } from '../../lib/rules/versions.ts';
export const seats: Seat[] = [0, 1, 2, 3].map((i) => ({
  enabled: true,
  profile: {
    id: 's' + i,
    name: 'AI ' + i,
    model: 'mock',
    providerId: 'mock',
    customInstructions: '',
    memoryMode: 'active',
  },
  connection: {
    id: 'mock',
    label: 'Mock',
    kind: 'openai-compatible',
    baseUrl: 'https://example.com',
    apiKey: 'DO_NOT_SAVE',
  },
}));
export const snapshot: ExperimentSnapshot = {
  ...DEFAULT_EXPERIMENT,
  batchId: 'b',
  batchSeed: 100,
  plannedGames: 1,
  gameIndex: 0,
};
export const opts = () => ({
  signal: new AbortController().signal,
  maxCalls: 1000,
  chat: false,
  retryDelayMs: 0,
  save: async () => {},
  saveMemory: async () => {},
  onUpdate: () => {},
  call: simulationCall,
});
export const shortRule = {
  ...BASE_RULE,
  config: { ...BASE_RULE.config, maxRounds: 2 },
};
export function longGame(n = 3): GameRecord {
  const r = newRecord(
    seats.slice(0, n),
    { ...BASE_RULE, config: { ...BASE_RULE.config, maxRounds: 21 } },
    22,
    'simulation',
    snapshot,
  );
  return r;
}
export const passCall: CallModel = async (s, task, input, signal) => {
  if (task === 'decision') {
    const actions = (
      input as { legalActions: Array<{ id: string; action: { type: string } }> }
    ).legalActions;
    return {
      data: {
        actionId: (
          actions.find(
            (a) =>
              a.action.type === 'end_buy' || a.action.type === 'skip_order',
          ) || actions[0]
        ).id,
        reason: 'keep',
        publicMessage: '',
      },
      latencyMs: 0,
      usage: { inputTokens: 0, outputTokens: 0 },
    };
  }
  return simulationCall(s, task, input, signal);
};
