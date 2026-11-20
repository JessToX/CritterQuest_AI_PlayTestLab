import type { ModelSettings } from './types.ts';
export interface FailureDetails {
  code:
    | 'timeout'
    | 'cancelled'
    | 'network'
    | 'http'
    | 'invalid_json'
    | 'invalid_action'
    | 'empty_response'
    | 'truncated'
    | 'unknown';
  message: string;
  retryable: boolean;
  status?: number;
  requestId?: string;
  phase?: 'connecting' | 'reading' | 'parsing';
  timeoutMs?: number;
  retryAfterMs?: number;
  latencyMs?: number;
  usage?: { inputTokens: number; outputTokens: number };
}
export class ModelFailure extends Error {
  details: FailureDetails;
  constructor(details: FailureDetails) {
    super(details.message);
    this.name = 'ModelFailure';
    this.details = details;
  }
}
export function failureDetails(error: unknown): FailureDetails {
  if (error instanceof ModelFailure) return error.details;
  const name = error instanceof Error ? error.name : '';
  const message =
    error instanceof Error ? error.message : '模型调用失败，原因未确定';
  // Use only known error codes, never raw socket/URL messages containing credentials.
  let cause: unknown = error;
  const codes: string[] = [];
  for (
    let depth = 0;
    depth < 5 && cause && typeof cause === 'object';
    depth++
  ) {
    const item = cause as { code?: unknown; cause?: unknown };
    if (typeof item.code === 'string') codes.push(item.code);
    cause = item.cause;
  }
  const descriptions: Record<string, string> = {
    ENOTFOUND: '接口域名解析失败，请检查接口地址和 DNS',
    EAI_AGAIN: 'DNS 暂时无法解析接口域名',
    ECONNREFUSED: '接口或代理拒绝连接，请检查代理是否仍在运行',
    ECONNRESET: '接口或代理在请求过程中断开连接',
    UND_ERR_SOCKET: '接口或代理在响应完成前断开连接',
    UND_ERR_CONNECT_TIMEOUT: '连接接口或代理超时，尚未取得模型响应',
    UND_ERR_HEADERS_TIMEOUT: '接口迟迟未返回响应头',
    UND_ERR_BODY_TIMEOUT: '接口响应传输停滞超时',
    CERT_HAS_EXPIRED: '接口或代理的 TLS 证书已过期',
    DEPTH_ZERO_SELF_SIGNED_CERT: '接口或代理的 TLS 证书无法验证',
    UNABLE_TO_VERIFY_LEAF_SIGNATURE: '接口或代理的 TLS 证书链无法验证',
  };
  const code = codes.find((c) => descriptions[c]);
  if (code)
    return {
      code: code.includes('TIMEOUT') ? 'timeout' : 'network',
      message: `${descriptions[code]}（${code}）`,
      retryable: !/CERT|SIGNATURE/.test(code),
    };
  if (name === 'TimeoutError' || /timeout/i.test(message))
    return {
      code: 'timeout',
      message: '模型请求超过等待时限',
      retryable: true,
    };
  if (name === 'AbortError' || /aborted|取消|中止/i.test(message))
    return { code: 'cancelled', message: '请求已取消', retryable: false };
  if (name === 'TypeError' || /network|fetch failed/i.test(message))
    return {
      code: 'network',
      message: '网络连接失败，请检查接口和系统代理',
      retryable: true,
    };
  return {
    code: 'unknown',
    message: '模型调用失败，原因未确定',
    retryable: false,
  };
}
export function timeoutFor(task: string, settings?: ModelSettings) {
  const seconds =
    task === 'test'
      ? 30
      : task === 'chat'
        ? (settings?.chatTimeoutSeconds ?? 60)
        : task === 'decision'
          ? (settings?.decisionTimeoutSeconds ?? 180)
          : (settings?.summaryTimeoutSeconds ?? 180);
  if (!Number.isFinite(seconds) || seconds < 1 || seconds > 600)
    throw new Error('等待时限须为 1–600 秒');
  return seconds * 1000;
}
export function abortableDelay(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    signal.throwIfAborted();
    const done = () => {
      clearTimeout(timer);
      signal.removeEventListener('abort', cancel);
    };
    const cancel = () => {
      done();
      reject(signal.reason);
    };
    const timer = setTimeout(() => {
      done();
      resolve();
    }, ms);
    signal.addEventListener('abort', cancel, { once: true });
  });
}
