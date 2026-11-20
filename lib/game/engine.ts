import {
  ENGINE_REGISTRY,
  engineRegistration,
  OFFICIAL_RULE_ID,
  UNSUPPORTED_RELEASE_VERSION,
} from './registry.ts';
import type { GameAction, GameState, RuleConfig } from './types.ts';
export const DEFAULT_CONFIG = ENGINE_REGISTRY['v7.1'].config;
const engine = (state: GameState) => {
  if (state.ruleVersion !== OFFICIAL_RULE_ID || !state.marketGame)
    throw new Error(UNSUPPORTED_RELEASE_VERSION);
  return engineRegistration(state.config).engine;
};
export function createGame(
  names: string[],
  seed = Date.now(),
  config: RuleConfig = DEFAULT_CONFIG,
  version = engineRegistration(config).ruleVersion,
) {
  if (version !== OFFICIAL_RULE_ID)
    throw new Error(UNSUPPORTED_RELEASE_VERSION);
  return engineRegistration(config).engine.createGame(
    names,
    seed,
    config,
    version,
  );
}
export const startTurn = (state: GameState) => engine(state).startTurn(state);
export const legalActions = (state: GameState) =>
  engine(state).legalActions(state);
export const applyAction = (state: GameState, action: GameAction) =>
  engine(state).applyAction(state, action);
export const visibleStateFor = (state: GameState, id: string) =>
  engine(state).visibleStateFor(state, id);
