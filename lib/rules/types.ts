import type { RuleConfig } from '../game/types.ts';
export interface RuleVersion {
  id: string;
  label: string;
  text: string;
  config: RuleConfig;
  hash: string;
  changes: string[];
  unsupported: string[];
  createdAt: string;
  sourceKey?: string;
}
