// License scope: V7.1 rule summary and registration are mapped in LICENSE-SCOPE.md.
import * as market from './engines/v71.ts';
import type {
  GameAction,
  GameState,
  LegalAction,
  RuleConfig,
  VisibleGameState,
} from './types.ts';

export interface GameEngine {
  createGame(
    names: string[],
    seed?: number,
    config?: RuleConfig,
    version?: string,
  ): GameState;
  startTurn(state: GameState): GameState;
  legalActions(state: GameState): LegalAction[];
  applyAction(state: GameState, action: GameAction): GameState;
  visibleStateFor(state: GameState, playerId: string): VisibleGameState;
}

export interface EngineCapabilities {
  minimumPlayers: number;
  ruleSummary?: string;
}

export interface EngineRegistration {
  engine: GameEngine;
  config: RuleConfig;
  ruleVersion: string;
  engineVersion: string;
  capabilities: EngineCapabilities;
}

export const OFFICIAL_RULE_ID = 'final-v7.1';
export const OFFICIAL_ENGINE_ID = 'v7.1-engine-1';
export const UNSUPPORTED_RELEASE_VERSION =
  '此版本仅支持 V7.1 正式规则。旧版对局和规则无法打开、导入或继续，原记录会保留。';

export const ENGINE_REGISTRY = {
  'v7.1': {
    engine: market,
    config: market.V71_CONFIG,
    ruleVersion: OFFICIAL_RULE_ID,
    engineVersion: OFFICIAL_ENGINE_ID,
    capabilities: {
      minimumPlayers: 2,
      ruleSummary:
        'V7.1：2–4 人；79 张主牌、12 张公共订单、40 币。买 → 交 → 抽 → 交 → 整理；普通食物 3 币、事件 2 币；标准 3 单或快速 2 单即时获胜。',
    },
  },
} satisfies Record<'v7.1', EngineRegistration>;

export function engineRegistration(config: RuleConfig): EngineRegistration {
  if (config?.mechanics !== 'v7.1')
    throw new Error(UNSUPPORTED_RELEASE_VERSION);
  return ENGINE_REGISTRY['v7.1'];
}
