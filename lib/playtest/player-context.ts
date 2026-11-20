import { visibleStateFor } from '../game/engine.ts';
import { marketDecisionView } from '../game/market.ts';
import { memoriesFor } from '../memory/selection.ts';
import { adjudicationsFor } from '../rules/versions.ts';
import type { RuntimeContext } from './runtime.ts';
export function createPlayerContext({ r, seats, entries }: RuntimeContext) {
  const context = (i: number) => {
    const seat = seats[i],
      pid = r.state.players[i].id;
    const pool =
      seat.profile.memoryMode === 'frozen'
        ? r.frozenMemories?.[seat.profile.id] || []
        : memoriesFor(entries, seat, r.rule.id, r.mode);
    const stage =
      seat.profile.memoryMode === 'active'
        ? r
            .summaryJobs!.filter(
              (j) =>
                j.playerId === pid &&
                j.status === 'complete' &&
                j.kind === 'checkpoint',
            )
            .sort((a, b) => b.round - a.round)[0]?.content
        : undefined;
    let budget = r.experiment?.memoryBudgetChars ?? 16000;
    const memories: Array<{
      kind: string;
      content: string;
      sourceGameIds: string[];
    }> = [];
    for (const m of [...pool].sort(
      (a, b) =>
        (a.kind === 'strategy' ? -1 : 0) - (b.kind === 'strategy' ? -1 : 0) ||
        b.createdAt.localeCompare(a.createdAt),
    )) {
      if (m.content.length <= budget) {
        memories.push({
          kind: m.kind,
          content: m.content,
          sourceGameIds: m.sourceGameIds,
        });
        budget -= m.content.length;
      }
    }
    return {
      rulebook: r.rule.text,
      executableParameters: r.state.config,
      adjudicationNotes:
        r.adjudicationNotes ?? adjudicationsFor(r.state.config),
      customInstructions: seat.profile.customInstructions,
      visibleState: marketDecisionView(visibleStateFor(r.state, pid)),
      memories,
      stageMemory: stage,
      personalHistory: r.observations[pid].slice(-12),
      publicChat: r.chat.slice(-12),
    };
  };
  return context;
}
