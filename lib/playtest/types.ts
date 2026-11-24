import { type FailureDetails } from '../agents/diagnostics.ts';
import type { AgentProfile, ProviderConnection } from '../agents/types.ts';
import type { GameAction, GameState } from '../game/types.ts';
import type { MemoryEntry } from '../memory/types.ts';
import { type RuleVersion } from '../rules/types.ts';
import { type ExperimentSnapshot } from './experiment.ts';
export interface Seat {
  profile: AgentProfile;
  connection: ProviderConnection;
  enabled: boolean;
}
export interface ModelResult {
  data: Record<string, unknown>;
  latencyMs: number;
  requestId?: string;
  usageKnown?: boolean;
  usage: { inputTokens: number; outputTokens: number };
}
export type CallModel = (
  seat: Seat,
  task: string,
  input: unknown,
  signal?: AbortSignal,
) => Promise<ModelResult>;

export interface CallLog {
  seatId: string;
  task: string;
  turn: number;
  latencyMs: number;
  inputTokens: number;
  outputTokens: number;
  error?: string;
  details?: FailureDetails;
  model?: string;
  provider?: string;
  attempt?: number;
  round?: number;
  requestId?: string;
  usageKnown?: boolean;
  inputChars?: number;
}
export interface DecisionLog {
  id: string;
  seatId: string;
  name: string;
  model: string;
  turn: number;
  action: GameAction;
  label: string;
  reason: string;
  status: 'selected' | 'executed';
}
export interface SummaryJob {
  id: string;
  playerId: string;
  round: number;
  kind: 'checkpoint' | 'reflection';
  status: 'pending' | 'complete' | 'failed' | 'cancelled';
  content?: string;
  error?: string;
  createdAt?: string;
  input?: unknown;
}
export interface GameRecord {
  retryWait?: {
    name: string;
    model: string;
    task: string;
    until: number;
    nextAttempt: number;
    reason: string;
  };
  experiment?: ExperimentSnapshot;
  initialPlayers?: GameState['players'];
  initialFirstPlayerId?: string;
  runtime?: { chat: boolean; maxCalls: number };
  summaryJobs?: SummaryJob[];
  frozenMemories?: Record<string, MemoryEntry[]>;
  inFlight?: {
    name: string;
    model: string;
    task: string;
    startedAt: number;
    timeoutMs: number;
    attempt: number;
  };
  engineVersion?: string;
  adjudicationNotes?: string;
  id: string;
  state: GameState;
  rule: RuleVersion;
  mode: 'api' | 'simulation';
  status: 'running' | 'paused' | 'complete' | 'terminated';
  title?: string;
  notes?: string;
  terminatedAt?: string;
  terminationReason?: string;
  seats: Array<{
    id: string;
    portrait?: string;
    name: string;
    model: string;
    provider: string;
    memoryMode: string;
    customInstructions: string;
    connection?: Omit<ProviderConnection, 'apiKey'>;
    connectionFingerprint?: string;
    modelSettings?: AgentProfile['modelSettings'];
  }>;
  decisions?: DecisionLog[];
  chatChoices?: Array<{
    speaker: string;
    turn: number;
    spoke: boolean;
    failed?: boolean;
    error?: string;
  }>;
  publicTalkVersion?: 1;
  chat: Array<{
    speaker: string;
    message: string;
    turn: number;
    channel?: 'public-table-v1';
  }>;
  calls: CallLog[];
  reservedCallCount?: number;
  observations: Record<string, string[]>;
  opportunityLog?: Array<{
    turn: number;
    playerId: string;
    character: string;
    available: boolean;
    used: boolean;
    passed: boolean;
    ready?: boolean;
    rechargeAvailable?: boolean;
    comboAvailable?: boolean;
  }>;
  reflections: Record<string, string>;
  talkedTurn: number;
  replies: string[];
  createdAt: string;
  error?: string;
  pendingDecision?: {
    logId?: string;
    index: number;
    action: GameAction;
    reason: string;
    publicMessage: string;
  };
}
