import { timeoutFor } from './diagnostics.ts';
import type { ModelSettings, ProviderConnection } from './types.ts';

export function requestLimits(
  connection: ProviderConnection,
  task: string,
  settings?: ModelSettings,
) {
  const idleMs = timeoutFor(task, settings);
  let official = false;
  try {
    official =
      new URL(connection.baseUrl || '').hostname === 'api.deepseek.com';
  } catch {
    /* validated by caller */
  }
  const adaptive =
    official &&
    connection.kind === 'openai-compatible' &&
    task === 'decision' &&
    settings?.stream !== false &&
    settings?.decisionTimeoutSeconds === undefined;
  return { idleMs, totalMs: adaptive ? 600000 : idleMs, adaptive };
}

export function requestDeadline(limits: {
  idleMs: number;
  totalMs: number;
  adaptive: boolean;
}) {
  const controller = new AbortController();
  let reason = '';
  const abort = (message: string) => {
    if (controller.signal.aborted) return;
    reason = message;
    controller.abort(new DOMException(message, 'TimeoutError'));
  };
  const total = setTimeout(
    () => abort(`模型请求等待超过 ${limits.totalMs / 1000} 秒总上限`),
    limits.totalMs,
  );
  let idle: ReturnType<typeof setTimeout> | undefined;
  const progress = () => {
    if (!limits.adaptive || controller.signal.aborted) return;
    clearTimeout(idle);
    idle = setTimeout(
      () =>
        abort(
          `模型连续 ${limits.idleMs / 1000} 秒没有新的生成内容，已停止等待`,
        ),
      limits.idleMs,
    );
  };
  progress();
  return {
    signal: controller.signal,
    progress,
    reason: () => reason,
    close: () => {
      clearTimeout(total);
      clearTimeout(idle);
    },
  };
}
