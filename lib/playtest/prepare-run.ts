import { publicDecisionMessage } from '../agents/public-output.ts';
import {
  engineRegistration,
  UNSUPPORTED_RELEASE_VERSION,
} from '../game/registry.ts';
import { memoriesFor } from '../memory/selection.ts';
import type { MemoryEntry } from '../memory/types.ts';
import { isOfficialGame } from '../rules/scope.ts';
import { adjudicationsFor } from '../rules/versions.ts';
import type { RunOptions } from './runtime.ts';
import type { GameRecord, Seat } from './types.ts';

// Upgrade only the working copy; callers may retain the historical snapshot for replay.
export function prepareRun(
  record: GameRecord,
  seats: Seat[],
  entries: MemoryEntry[],
  options: RunOptions,
) {
  if (!isOfficialGame(record)) throw new Error(UNSUPPORTED_RELEASE_VERSION);
  if (
    !options.summaryOnly &&
    (record.status === 'terminated' || record.status === 'complete')
  )
    throw new Error('已结束的对局不能继续');
  const r = structuredClone(record);
  // Legacy talkedTurn was set only after the active player's old message.
  // New sessions track the active public call in replies, including interruption.
  if (r.publicTalkVersion !== 1 && r.talkedTurn === r.state.turn) {
    const activeSeat = seats[r.state.activePlayerIndex];
    if (activeSeat && !r.replies.includes(activeSeat.profile.id))
      r.replies.push(activeSeat.profile.id);
  }
  r.publicTalkVersion = 1;
  if (r.pendingDecision)
    r.pendingDecision.publicMessage = publicDecisionMessage(
      r.pendingDecision.publicMessage,
    );
  if (!options.summaryOnly) {
    r.status = 'running';
    if (r.state.config.mechanics) {
      r.engineVersion = engineRegistration(r.state.config).engineVersion;
      r.adjudicationNotes = adjudicationsFor(r.state.config);
    }
  }
  r.runtime ??= { chat: options.chat, maxCalls: options.maxCalls };
  if (r.mode === 'api') options = { ...options, maxCalls: r.runtime.maxCalls };
  r.summaryJobs ??= [];
  r.opportunityLog ??= [];
  r.frozenMemories ??= Object.fromEntries(
    seats
      .filter((s) => s.profile.memoryMode === 'frozen')
      .map((s) => [
        s.profile.id,
        structuredClone(memoriesFor(entries, s, r.rule.id, r.mode)),
      ]),
  );
  const prepared = Object.assign(r, { decisions: r.decisions ?? [] });
  r.chatChoices ??= [];
  delete r.error;
  delete r.retryWait;
  return { record: prepared, options };
}
