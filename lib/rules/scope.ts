import { OFFICIAL_ENGINE_ID, OFFICIAL_RULE_ID } from '../game/registry.ts';
import type { RuleVersion } from './types.ts';
import { BASE_RULE } from './versions.ts';

export function isOfficialRule(value: unknown): value is RuleVersion {
  const rule = value as Partial<RuleVersion> | null;
  return (
    rule?.id === OFFICIAL_RULE_ID &&
    rule.hash === BASE_RULE.hash &&
    rule.text === BASE_RULE.text &&
    rule.config?.mechanics === 'v7.1'
  );
}

export function isOfficialGame(value: unknown): boolean {
  const game = value as {
    rule?: unknown;
    engineVersion?: unknown;
    state?: {
      ruleVersion?: unknown;
      config?: { mechanics?: unknown };
      marketGame?: unknown;
    };
  } | null;
  return (
    !!game &&
    isOfficialRule(game.rule) &&
    game.engineVersion === OFFICIAL_ENGINE_ID &&
    game.state?.ruleVersion === OFFICIAL_RULE_ID &&
    game.state.config?.mechanics === 'v7.1' &&
    !!game.state.marketGame
  );
}
