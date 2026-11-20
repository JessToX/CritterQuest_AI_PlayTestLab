import type { createPlayerContext } from './player-context.ts';
import type { ModelCaller, RuntimeContext } from './runtime.ts';
export function createSummarizer(
  { r, seats, options, publish }: RuntimeContext,
  call: ModelCaller,
  context: ReturnType<typeof createPlayerContext>,
) {
  const summarize = async (
    kind: 'checkpoint' | 'reflection',
    round: number,
    onlyPlayer?: string,
  ) => {
    for (let i = 0; i < seats.length; i++) {
      options.signal.throwIfAborted();
      if (onlyPlayer && r.state.players[i].id !== onlyPlayer) continue;
      const pid = r.state.players[i].id,
        id = `${kind}-${round}-${pid}`;
      let job = r.summaryJobs!.find((j) => j.id === id);
      if (!job) {
        job = { id, playerId: pid, kind, round, status: 'pending' };
        r.summaryJobs!.push(job);
      }
      if (
        kind === 'reflection' &&
        r.reflections[pid] &&
        job.status !== 'complete'
      ) {
        job.status = 'complete';
        job.content = r.reflections[pid];
      }
      if (job.status === 'complete') continue;
      job.status = 'pending';
      delete job.error;
      await publish();
      try {
        job.input ??= structuredClone({
          ...context(i),
          previousSummary: r
            .summaryJobs!.filter(
              (j) => j.playerId === pid && j.status === 'complete',
            )
            .at(-1)?.content,
          observations: r.observations[pid],
          completedRounds: round,
          result:
            kind === 'reflection'
              ? {
                  status: r.status,
                  winnerId: r.state.winnerId,
                  unfinished: r.status === 'terminated',
                }
              : undefined,
        });
        await publish();
        const result = await call(i, kind, job.input);
        if (typeof result.reflection !== 'string' || !result.reflection.trim())
          throw new Error('模型未返回有效总结');
        job.content = result.reflection
          .trim()
          .slice(0, kind === 'checkpoint' ? 4000 : 12000);
        job.status = 'complete';
        job.createdAt = new Date().toISOString();
        if (kind === 'reflection') r.reflections[pid] = job.content;
      } catch (error) {
        job.status = options.signal.aborted ? 'cancelled' : 'failed';
        job.error = error instanceof Error ? error.message : '总结生成失败';
        if (options.signal.aborted) throw error;
      }
      await publish();
    }
  };
  return summarize;
}
