import { memoryKey } from '../memory/selection.ts';
import type { MemoryEntry } from '../memory/types.ts';
import { adjudicationsFor } from '../rules/versions.ts';
import type { ModelCaller, RuntimeContext } from './runtime.ts';
export async function rememberGame(
  { r, seats, entries, options }: RuntimeContext,
  call: ModelCaller,
) {
  const persistMemory = async (entry: MemoryEntry) => {
    await options.saveMemory(entry);
    const index = entries.findIndex((candidate) => candidate.id === entry.id);
    if (index >= 0) entries[index] = entry;
    else entries.push(entry);
  };
  for (let i = 0; i < seats.length; i++) {
    const seat = seats[i],
      pid = r.state.players[i].id;
    if (
      options.summaryTarget?.playerId &&
      options.summaryTarget.playerId !== pid
    )
      continue;
    if (seat.profile.memoryMode !== 'active' || !r.reflections[pid]) continue;
    const id = r.id + '-' + seat.profile.id;
    let entry = entries.find((e) => e.id === id);
    if (!entry) {
      entry = {
        id,
        agentId: memoryKey(seat, r.rule.id, r.mode),
        ruleVersion: r.rule.id,
        author: {
          seatId: seat.profile.id,
          name: seat.profile.name,
          provider: seat.connection.label,
          model: seat.profile.model,
        },
        mode: r.mode,
        allowedReaders: [],
        kind: 'episode',
        content: r.reflections[pid],
        sourceGameIds: [r.id],
        createdAt: new Date().toISOString(),
        active: true,
        outcome: r.status === 'terminated' ? 'terminated' : 'complete',
      };
      await persistMemory(entry);
    }
    const strategies = entries.filter(
      (e) => e.agentId === entry!.agentId && e.kind === 'strategy',
    );
    const used = new Set(strategies.flatMap((e) => e.sourceGameIds));
    const recent = entries
      .filter(
        (e) =>
          e.agentId === entry!.agentId &&
          e.kind === 'episode' &&
          e.active &&
          e.outcome !== 'terminated' &&
          !e.strategyBatchId &&
          !e.sourceGameIds.some((id) => used.has(id)),
      )
      .sort(
        (a, b) =>
          a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id),
      )
      .slice(0, 10);
    if (recent.length === 10) {
      try {
        const batchId = 'batch-' + recent[0].id + '-' + recent[9].id;
        const result = await call(i, 'batch', {
          rulebook: r.rule.text,
          adjudicationNotes:
            r.adjudicationNotes ?? adjudicationsFor(r.state.config),
          episodes: recent.map((e) => ({
            content: e.content,
            sourceGameIds: e.sourceGameIds,
          })),
        });
        if (typeof result.reflection !== 'string' || !result.reflection.trim())
          throw new Error('模型未返回十局总结');
        const batch: MemoryEntry = {
          ...entry,
          id: batchId,
          kind: 'strategy',
          content: result.reflection.slice(0, 12000),
          sourceGameIds: recent.flatMap((e) => e.sourceGameIds),
          createdAt: new Date().toISOString(),
          batchOrdinal:
            Math.max(
              0,
              ...entries
                .filter((e) => e.agentId === entry!.agentId)
                .map((e) => e.batchOrdinal || 0),
            ) + 1,
        };
        await persistMemory(batch);
        for (const episode of recent) {
          episode.strategyBatchId = batchId;
          episode.batchOrdinal = batch.batchOrdinal;
          await persistMemory(episode);
        }
      } catch (error) {
        if (options.signal.aborted) throw error;
        r.error = error instanceof Error ? error.message : '十局总结失败';
      }
    }
  }
}
