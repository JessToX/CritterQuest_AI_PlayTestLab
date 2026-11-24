import { publicDecisionMessage } from '../agents/public-output.ts';
import {
  applyAction,
  legalActions,
  startTurn,
  visibleStateFor,
} from '../game/engine.ts';
import { actionLabel } from '../game/labels.ts';
import type { MemoryEntry } from '../memory/types.ts';
import { prepareRun } from './prepare-run.ts';
import { createModelCaller } from './model-caller.ts';
import { createPlayerContext } from './player-context.ts';
import { rememberGame } from './remember-game.ts';
import type { RunOptions } from './runtime.ts';
import { createSummarizer } from './summaries.ts';
import { createReply } from './table-talk.ts';
import type { GameRecord, Seat } from './types.ts';
const textValue = (value: unknown) => (typeof value === 'string' ? value : '');
export async function runGame(
  record: GameRecord,
  seats: Seat[],
  entries: MemoryEntry[],
  requestedOptions: RunOptions,
): Promise<GameRecord> {
  const { record: r, options } = prepareRun(
    record,
    seats,
    entries,
    requestedOptions,
  );
  const publish = async () => {
    options.onUpdate(structuredClone(r));
    await options.save(r);
  };
  const runtime = { r, seats, entries, options, publish };
  const call = createModelCaller(runtime);
  const context = createPlayerContext(runtime);
  const summarize = createSummarizer(runtime, call, context);
  const reply = createReply(runtime, call);
  try {
    if (options.summaryOnly && options.summaryTarget) {
      await summarize(
        options.summaryTarget.kind,
        options.summaryTarget.round,
        options.summaryTarget.playerId,
      );
      if (options.summaryTarget.kind === 'checkpoint') return r;
    }
    while (!options.summaryOnly && r.state.status === 'active') {
      options.signal.throwIfAborted();
      if (r.state.phase === 'start') {
        const completedRounds = Math.floor((r.state.turn - 1) / seats.length);
        if (
          completedRounds > 0 &&
          completedRounds % 10 === 0 &&
          (r.state.turn - 1) % seats.length === 0
        )
          await summarize('checkpoint', completedRounds);
        r.state = startTurn(r.state);
        await publish();
      }
      const turn = r.state.turn,
        active = r.state.activePlayerIndex;
      if (options.chat && r.talkedTurn === turn) {
        for (const i of [
          active,
          ...seats.map((_, i) => i).filter((i) => i !== active),
        ])
          if (!r.replies.includes(seats[i].profile.id)) await reply(i, turn);
      }
      const index = r.state.players.findIndex(
          (p) => p.id === r.state.decisionPlayerId,
        ),
        actions = legalActions(r.state);
      if (!actions.length) throw new Error('规则引擎没有给出合法动作');
      let decision: Record<string, unknown> | undefined;
      if (!r.pendingDecision) {
        decision = await call(index, 'decision', {
          ...context(index),
          legalActions: actions,
        });
      }
      const chosen = r.pendingDecision
        ? actions.find(
            (a) =>
              JSON.stringify(a.action) ===
              JSON.stringify(r.pendingDecision!.action),
          )
        : actions.find((a) => a.id === decision!.actionId);
      if (!chosen)
        throw new Error(
          '待执行动作与当前合法动作不匹配，牌局已暂停，请检查保存记录',
        );
      if (!r.pendingDecision) {
        r.pendingDecision = {
          index,
          action: chosen.action,
          reason: textValue(decision!.reason).slice(0, 800),
          publicMessage: publicDecisionMessage(decision!.publicMessage),
        };
      }
      if (!r.pendingDecision.logId) {
        const id = crypto.randomUUID();
        r.pendingDecision.logId = id;
        r.decisions.push({
          id,
          seatId: seats[index].profile.id,
          name: seats[index].profile.name,
          model: seats[index].profile.model,
          turn,
          action: structuredClone(chosen.action),
          label: chosen.label,
          reason: r.pendingDecision.reason,
          status: 'selected',
        });
        await publish();
      }
      const p = r.state.players[index];
      if (options.chat && r.talkedTurn !== turn && index === active) {
        r.talkedTurn = turn;
        r.replies = [];
        await publish();
        // Public speech is independently generated before resolving the move.
        for (const i of [
          active,
          ...seats.map((_, i) => i).filter((i) => i !== active),
        ])
          await reply(i, turn);
      }
      options.signal.throwIfAborted();
      r.observations[p.id].push(
        '回合 ' +
          turn +
          ' ' +
          r.state.phase +
          ' ' +
          actionLabel(chosen.action, r.state, p.id) +
          ' 理由：' +
          r.pendingDecision.reason,
      );
      r.state = applyAction(r.state, chosen.action);
      const log = r.decisions.find((d) => d.id === r.pendingDecision?.logId);
      if (log) log.status = 'executed';
      delete r.pendingDecision;
      for (let i = 0; i < seats.length; i++) {
        const view = visibleStateFor(r.state, r.state.players[i].id);
        const previous = r.observations[view.self.id];
        const seen = new Set(previous.map((x) => x.split(' ')[0]));
        for (const event of view.recentEvents)
          if (!seen.has(event.id))
            previous.push(
              `${event.id} 第${event.round}轮 ${event.publicText}${event.privateTextByPlayer?.[view.self.id] ? '；本人信息：' + event.privateTextByPlayer[view.self.id] : ''}`,
            );
        r.observations[view.self.id] = previous.slice(-120);
      }
      await publish();
    }
    if (r.status !== 'terminated') r.status = 'complete';
    await publish();
    const rounds =
      r.state.status === 'active'
        ? Math.floor((r.state.turn - 1) / seats.length)
        : Math.floor(r.state.turn / seats.length);
    if (!options.summaryTarget) await summarize('reflection', rounds);
    await rememberGame(runtime, call);
    await publish();
  } catch (e) {
    const terminated =
      options.signal.aborted && options.signal.reason === 'terminate';
    r.status = options.summaryOnly
      ? record.status
      : r.state.status !== 'active'
        ? 'complete'
        : terminated
          ? 'terminated'
          : 'paused';
    delete r.inFlight;
    if (terminated && r.status === 'terminated') {
      r.terminatedAt = new Date().toISOString();
      r.terminationReason = '用户终止对局及批次';
    }
    r.error = options.signal.aborted
      ? options.summaryOnly
        ? '总结已取消，游戏结果保留，可单独补生成'
        : terminated
          ? '对局已终止，批次已停止'
          : r.status === 'complete'
            ? '牌局已完成，总结已取消，可单独补生成'
            : '已暂停，可继续当前牌局'
      : e instanceof Error
        ? e.message
        : '牌局暂停';
    await publish();
  }
  return r;
}
