import {
  ModelFailure,
  failureDetails,
  type FailureDetails,
} from './diagnostics.ts';
import { requestDeadline, requestLimits } from './request-deadline.ts';
import {
  parseModelContent,
  providerRequestId,
  providerRequestReference,
  readChatStream,
  readBoundedJson,
  type CompletionBody,
} from './response.ts';
import { providerBaseUrl } from './provider-endpoint.ts';
import {
  prepareModelRequest,
  providerHeaders,
  type ModelRequestOptions,
} from './model-request.ts';
import { boundPublicOutput } from './public-output.ts';
import type { ProviderConnection } from './types.ts';
let localFetch: typeof fetch | undefined;
export function configureLocalModelFetch(transport: typeof fetch) {
  localFetch = transport;
}
export async function requestModel(
  connection: ProviderConnection,
  model: string,
  system: string,
  input: unknown,
  signal?: AbortSignal,
  options: ModelRequestOptions = {},
) {
  const { kind, baseUrl, endpoint, payload } = prepareModelRequest(
    connection,
    model,
    system,
    input,
    options,
  );
  const started = Date.now();
  const limits = requestLimits(
    connection,
    options.task || 'decision',
    options.settings,
  );
  const timeoutMs = limits.totalMs;
  const deadline = requestDeadline(limits);
  const combined = signal
    ? AbortSignal.any([signal, deadline.signal])
    : deadline.signal;
  let phase: FailureDetails['phase'] = 'connecting',
    requestId: string | undefined;
  let usage: { inputTokens: number; outputTokens: number } | undefined;
  try {
    const response = await (localFetch || fetch)(endpoint, {
      method: 'POST',
      redirect: 'manual',
      signal: combined,
      headers: {
        'Content-Type': 'application/json',
        ...providerHeaders(kind, connection.apiKey),
      },
      body: JSON.stringify(payload),
    });
    requestId =
      providerRequestId(response.headers.get('x-request-id')) ||
      providerRequestId(response.headers.get('request-id'));
    phase = 'reading';
    if (!response.ok) {
      const retry = response.headers.get('retry-after');
      const parsedRetryAfterMs = retry
        ? Math.min(
            60000,
            Math.max(
              0,
              Number.isFinite(Number(retry))
                ? Number(retry) * 1000
                : Date.parse(retry) - Date.now(),
            ),
          )
        : undefined;
      const retryAfterMs = Number.isFinite(parsedRetryAfterMs)
        ? parsedRetryAfterMs
        : undefined;
      await response.body?.cancel().catch(() => {});
      const status = response.status;
      const message =
        status >= 300 && status < 400
          ? 'API 地址发生跳转，请填写最终 HTTPS 地址'
          : status === 401 || status === 403
            ? 'API 鉴权失败，请检查密钥及权限'
            : status === 402
              ? 'API 余额不足'
              : status === 504
                ? `上游网关 ${new URL(baseUrl).hostname} 等待模型响应超时（HTTP 504）；本地等待上限为 ${timeoutMs / 1000} 秒，增加本地时限不能延长网关时限`
                : status === 429
                  ? '供应商请求限流'
                  : `模型请求失败（HTTP ${status}）`;
      throw new ModelFailure({
        code: 'http',
        message,
        status,
        requestId,
        retryAfterMs,
        retryable: status === 408 || status === 429 || status >= 500,
        phase,
      });
    }
    const body: CompletionBody = response.headers
      .get('content-type')
      ?.includes('text/event-stream')
      ? await readChatStream(response, deadline.progress)
      : ((await readBoundedJson(
          response,
          8 * 1024 * 1024,
          combined,
        )) as CompletionBody);
    phase = 'parsing';
    requestId = requestId || providerRequestId(body.id);
    if (body.usage)
      usage = {
        inputTokens: body.usage.input_tokens ?? body.usage.prompt_tokens ?? 0,
        outputTokens:
          body.usage.output_tokens ?? body.usage.completion_tokens ?? 0,
      };
    if (
      body.choices?.[0]?.finish_reason === 'length' ||
      body.stop_reason === 'max_tokens' ||
      body.incomplete_details?.reason === 'max_output_tokens'
    )
      throw new ModelFailure({
        code: 'truncated',
        message: '输出达到 Token 上限，未完成有效结果；请提高输出预算',
        retryable: false,
      });
    const content =
      kind === 'anthropic'
        ? body.content?.find((c) => c.type === 'text')?.text
        : kind === 'openai'
          ? body.output
              ?.flatMap((x) => x.content || [])
              .filter((c) => c.type === 'output_text')
              .map((c) => c.text)
              .join('')
          : body.choices?.[0]?.message?.content;
    if (!content)
      throw new ModelFailure({
        code: 'empty_response',
        message: '模型没有返回内容',
        retryable: true,
      });
    const data = boundPublicOutput(
      parseModelContent(content, options.task),
      options.task,
    );
    return {
      data,
      requestId: await providerRequestReference(requestId, connection.apiKey),
      usageKnown: !!usage,
      latencyMs: Date.now() - started,
      usage: {
        inputTokens: body.usage?.input_tokens ?? body.usage?.prompt_tokens ?? 0,
        outputTokens:
          body.usage?.output_tokens ?? body.usage?.completion_tokens ?? 0,
      },
    };
  } catch (error) {
    const details = signal?.aborted
      ? { code: 'cancelled' as const, message: '请求已取消', retryable: false }
      : deadline.signal.aborted
        ? {
            code: 'timeout' as const,
            message: deadline.reason(),
            retryable: true,
          }
        : failureDetails(error);
    throw new ModelFailure({
      ...details,
      phase: details.code === 'invalid_json' ? 'parsing' : phase,
      requestId: await providerRequestReference(
        details.requestId || requestId,
        connection.apiKey,
      ),
      timeoutMs,
      latencyMs: Date.now() - started,
      usage: details.usage || usage,
    });
  } finally {
    deadline.close();
  }
}

export async function listModels(
  connection: ProviderConnection,
  signal?: AbortSignal,
) {
  if (!connection.apiKey?.trim()) throw new Error('请先填写 API Key');
  const base = providerBaseUrl(connection);
  const combined = signal
    ? AbortSignal.any([signal, AbortSignal.timeout(20000)])
    : AbortSignal.timeout(20000);
  const response = await (localFetch || fetch)(base + '/models', {
    redirect: 'manual',
    signal: combined,
    headers: providerHeaders(connection.kind, connection.apiKey.trim()),
  });
  if (!response.ok) await response.body?.cancel().catch(() => {});
  if (response.status >= 300 && response.status < 400)
    throw new Error('API 地址发生跳转，请检查 Base URL');
  if (response.status === 401 || response.status === 403)
    throw new Error('API Key 无效或没有模型列表权限，请检查密钥');
  if (!response.ok)
    throw new Error(
      '获取模型列表失败（HTTP ' +
        response.status +
        '），可手动填写模型 ID 或 Endpoint ID',
    );
  const body = (await readBoundedJson(response, 2 * 1024 * 1024, combined)) as {
    data?: Array<{ id?: unknown }>;
  };
  const models = [
    ...new Set(
      (Array.isArray(body.data) ? body.data : [])
        .map((m) => m?.id)
        .filter((id): id is string => typeof id === 'string' && !!id.trim()),
    ),
  ].sort();
  if (!models.length)
    throw new Error('供应商没有返回可用模型，请手动填写模型 ID 或 Endpoint ID');
  return models;
}
