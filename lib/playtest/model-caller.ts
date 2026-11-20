import {
  abortableDelay,
  failureDetails,
  ModelFailure,
} from '../agents/diagnostics.ts';
import { validatePublicChatInput } from '../agents/public-output.ts';
import { requestLimits } from '../agents/request-deadline.ts';
import { taskNames } from '../game/labels.ts';
import type { RuntimeContext } from './runtime.ts';
export function createModelCaller({
  r,
  seats,
  options,
  publish,
}: RuntimeContext) {
  const call = async (
    index: number,
    task: string,
    input: unknown,
    attempts = 2,
  ) => {
    const originalSeat = seats[index];
    const seat =
      task === 'chat'
        ? {
            enabled: originalSeat.enabled,
            connection: originalSeat.connection,
            profile: {
              id: originalSeat.profile.id,
              name: originalSeat.profile.name,
              providerId: originalSeat.profile.providerId,
              model: originalSeat.profile.model,
              customInstructions: '',
              memoryMode: 'disabled' as const,
              modelSettings: originalSeat.profile.modelSettings,
            },
          }
        : originalSeat;
    if (task === 'chat') input = validatePublicChatInput(input);
    let last: unknown;
    for (let attempt = 1; attempt <= attempts; attempt++) {
      options.signal.throwIfAborted();
      const previous = Math.max(r.calls.length, r.reservedCallCount ?? 0);
      if (previous >= options.maxCalls)
        throw new Error('已达到本局固定调用上限，恢复和补生成共用此上限。');
      if (options.reserveCall) {
        r.reservedCallCount = await options.reserveCall(
          r.id,
          options.maxCalls,
          previous,
          options.signal,
        );
        options.signal.throwIfAborted();
      }
      const started = Date.now();
      r.inFlight = {
        name: seat.profile.name,
        model: seat.profile.model,
        task,
        startedAt: started,
        timeoutMs: requestLimits(
          seat.connection,
          task,
          seat.profile.modelSettings,
        ).totalMs,
        attempt,
      };
      options.onUpdate(structuredClone(r));
      try {
        const result = await options.call(
          seat,
          task,
          attempt > 1 && task !== 'chat'
            ? {
                ...(input as object),
                correction:
                  task === 'decision'
                    ? '上次调用未取得合法结果。仅复制一个 legalActions.id，返回完整 JSON。'
                    : '上次响应格式无效或请求失败。请严格按当前任务格式重新回答，总结任务直接返回中文正文。',
              }
            : input,
          options.signal,
        );
        if (
          task === 'decision' &&
          !(input as { legalActions: Array<{ id: string }> }).legalActions.some(
            (a) => a.id === result.data.actionId,
          )
        )
          throw new ModelFailure({
            code: 'invalid_action',
            message: '模型返回不合法动作，请复制合法动作 ID',
            retryable: true,
            usage: result.usage,
          });
        options.signal.throwIfAborted();
        r.calls.push({
          seatId: seat.profile.id,
          model: seat.profile.model,
          provider: seat.connection.label,
          task,
          turn: r.state.turn,
          round: r.state.round,
          attempt,
          latencyMs: result.latencyMs,
          ...result.usage,
          usageKnown: result.usageKnown ?? true,
          requestId: result.requestId,
          inputChars: JSON.stringify(input).length,
        });
        delete r.inFlight;
        return result.data;
      } catch (error) {
        const details = options.signal.aborted
          ? {
              code: 'cancelled' as const,
              message:
                options.signal.reason === 'page-unload'
                  ? '页面关闭或更新导致请求取消，可恢复对局'
                  : '请求已取消（暂停或终止）',
              retryable: false,
            }
          : failureDetails(error);
        const message = `${seat.profile.name} · ${seat.profile.model}｜第 ${r.state.round} 轮／玩家回合 ${r.state.turn}｜${taskNames[task] || task}｜${details.message}｜尝试 ${attempt}/${attempts}`;
        r.calls.push({
          seatId: seat.profile.id,
          model: seat.profile.model,
          provider: seat.connection.label,
          task,
          turn: r.state.turn,
          round: r.state.round,
          attempt,
          latencyMs: Date.now() - started,
          inputTokens: details.usage?.inputTokens ?? 0,
          outputTokens: details.usage?.outputTokens ?? 0,
          usageKnown: !!details.usage,
          requestId: details.requestId,
          inputChars: JSON.stringify(input).length,
          error: message,
          details,
        });
        delete r.inFlight;
        last = new ModelFailure({ ...details, message });
        await publish();
        if (
          options.signal.aborted ||
          !details.retryable ||
          attempt === attempts
        )
          throw last;
        const delayMs =
          details.retryAfterMs ?? options.retryDelayMs ?? 1000 * attempt;
        r.retryWait = {
          name: seat.profile.name,
          model: seat.profile.model,
          task,
          until: Date.now() + delayMs,
          nextAttempt: attempt + 1,
          reason:
            details.retryAfterMs !== undefined
              ? '接口要求等待后重试'
              : '暂时失败后自动重试',
        };
        await publish();
        try {
          await abortableDelay(delayMs, options.signal);
        } finally {
          delete r.retryWait;
        }
      }
    }
    throw last;
  };
  return call;
}
