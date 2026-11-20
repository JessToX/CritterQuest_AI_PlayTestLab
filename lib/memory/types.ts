export interface MemoryEntry {
  id: string;
  agentId: string;
  ruleVersion: string;
  kind: 'episode' | 'strategy';
  content: string;
  sourceGameIds: string[];
  createdAt: string;
  active: boolean;
  author?: { seatId: string; name: string; provider: string; model: string };
  mode?: string;
  allowedReaders?: string[];
  originalContent?: string;
  editedAt?: string;
  outcome?: 'complete' | 'terminated';
  batchOrdinal?: number;
  strategyBatchId?: string;
}
