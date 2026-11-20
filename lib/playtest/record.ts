import { type RuleVersion } from '../rules/types.ts';
import {
  engineRegistration,
  UNSUPPORTED_RELEASE_VERSION,
} from '../game/registry.ts';
import { isOfficialRule } from '../rules/scope.ts';
import { adjudicationsFor } from '../rules/versions.ts';
import {
  configuredGame,
  normalizeExperiment,
  connectionFingerprint,
  type ExperimentSnapshot,
} from './experiment.ts';
import type { GameRecord, Seat } from './types.ts';
export function newRecord(
  seats: Seat[],
  rule: RuleVersion,
  seed: number,
  mode: GameRecord['mode'],
  experiment?: ExperimentSnapshot,
): GameRecord {
  if (!isOfficialRule(rule)) throw new Error(UNSUPPORTED_RELEASE_VERSION);
  if (experiment) experiment = normalizeExperiment(rule.config, experiment);
  const state = configuredGame(
    seats.map((s) => s.profile.name),
    seed,
    rule.config,
    rule.id,
    experiment,
  );
  const id = crypto.randomUUID();
  state.id = id;
  return {
    engineVersion: engineRegistration(rule.config).engineVersion,
    experiment,
    initialPlayers: structuredClone(state.players),
    initialFirstPlayerId: state.players[state.activePlayerIndex].id,
    summaryJobs: [],
    opportunityLog: [],
    adjudicationNotes: adjudicationsFor(rule.config),
    id,
    state,
    rule: structuredClone({ ...rule, config: state.config }),
    mode,
    status: 'running',
    seats: seats.map((s) => ({
      id: s.profile.id,
      name: s.profile.name,
      model: s.profile.model,
      provider: s.connection.label,
      memoryMode: s.profile.memoryMode,
      customInstructions: s.profile.customInstructions,
      connection: {
        id: s.connection.id,
        label: s.connection.label,
        kind: s.connection.kind,
        baseUrl: s.connection.baseUrl,
      },
      connectionFingerprint: connectionFingerprint(s.connection),
      modelSettings: structuredClone(s.profile.modelSettings),
    })),
    publicTalkVersion: 1,
    chat: [],
    calls: [],
    observations: Object.fromEntries(state.players.map((p) => [p.id, []])),
    reflections: {},
    talkedTurn: 0,
    replies: [],
    createdAt: new Date().toISOString(),
  };
}
