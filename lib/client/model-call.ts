import { ModelFailure, type FailureDetails } from '../agents/diagnostics.ts';
import { requestLimits } from '../agents/request-deadline.ts';
import type { CallModel, ModelResult } from '../playtest/types.ts';
export const apiCall: CallModel = async (seat, task, input, signal) => {
  const timeout = AbortSignal.timeout(
    requestLimits(seat.connection, task, seat.profile.modelSettings).totalMs +
      15000,
  );
  let response: Response;
  try {
    response = await fetch('/api/agents/respond', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        connection: seat.connection,
        model: seat.profile.model,
        task,
        settings: seat.profile.modelSettings,
        input,
      }),
      signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
    });
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new ModelFailure({
      code: timeout.aborted ? 'timeout' : 'network',
      message: timeout.aborted
        ? '本地模型接口未在等待时限内返回结果；请检查本地服务状态'
        : '浏览器与本地模型接口的请求连接中断，尚未收到服务端诊断；请检查本地服务是否重启或连接是否中断',
      retryable: true,
    });
  }
  let result: ModelResult & { error?: string; details?: FailureDetails };
  try {
    result = await response.json();
  } catch {
    throw new ModelFailure({
      code: 'http',
      status: response.status,
      message: `本地接口未返回有效 JSON（HTTP ${response.status}），请检查服务及代理`,
      retryable: response.status >= 500,
      phase: 'reading',
    });
  }
  if (!response.ok)
    throw new ModelFailure(
      result.details || {
        code: 'http',
        message: result.error || `本地接口失败（HTTP ${response.status}）`,
        status: response.status,
        retryable: response.status >= 500,
      },
    );
  return result;
};

export async function reserveApiCall(
  gameId: string,
  limit: number,
  previous: number,
  signal: AbortSignal,
) {
  const response = await fetch('/api/lab/call-budget', {
    method: 'POST',
    redirect: 'error',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ gameId, limit, previous }),
    signal,
  });
  if (response.status === 409)
    throw new Error('已达到本局固定调用上限，恢复和补生成共用此上限。');
  if (!response.ok) throw new Error('无法确认本局调用额度，已停止模型请求。');
  const { used } = (await response.json()) as { used: number };
  if (!Number.isSafeInteger(used) || used <= previous || used > limit)
    throw new Error('无法确认本局调用额度，已停止模型请求。');
  return used;
}
