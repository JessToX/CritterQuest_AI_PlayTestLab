import type {
  GameAction,
  LegalAction,
  VisibleGameState,
} from '../game/types.ts';
import type { MemoryEntry } from '../memory/types.ts';

export type ProviderKind = 'openai' | 'anthropic' | 'openai-compatible';

export interface ProviderConnection {
  id: string;
  label: string;
  kind: ProviderKind;
  baseUrl?: string;
  apiKey: string;
}

export interface AgentProfile {
  id: string;
  name: string;
  providerId: string;
  model: string;
  customInstructions: string;
  memoryMode: 'active' | 'frozen' | 'disabled';
  memorySnapshotId?: string;
  modelSettings?: ModelSettings;
}

export interface DecisionContext {
  agent: AgentProfile;
  state: VisibleGameState;
  legalActions: LegalAction[];
  rulebook: string;
  memories: MemoryEntry[];
  publicChat: Array<{ speaker: string; message: string }>;
}

export interface ActionDecision {
  action: GameAction;
  publicMessage: string;
  reason: string;
  providerRequestId?: string;
  usage?: { inputTokens?: number; outputTokens?: number };
}

export interface ModelSettings {
  stream?: boolean;
  decisionTimeoutSeconds?: number;
  chatTimeoutSeconds?: number;
  summaryTimeoutSeconds?: number;
  maxOutputTokens?: number;
  reasoningEffort?: string;
  thinking?: 'enabled' | 'disabled';
}
