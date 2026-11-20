import { ModelFailure } from './diagnostics.ts';

// Extract complete objects without repairing strings, inventing fields, or using reasoning text.
export function parseModelContent(
  content: string,
  task?: string,
): Record<string, unknown> {
  const text = content
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '');
  const object = (value: unknown): value is Record<string, unknown> =>
    !!value && typeof value === 'object' && !Array.isArray(value);
  let parsed: unknown;
  let validJson = false;
  try {
    parsed = JSON.parse(text);
    validJson = true;
  } catch {
    /* Try a single complete object inside surrounding prose. */
  }
  if (validJson) {
    if (object(parsed)) return parsed;
    throw new ModelFailure({
      code: 'invalid_json',
      message: '模型返回格式必须是对象',
      retryable: true,
    });
  }
  let start = -1,
    depth = 0,
    quoted = false,
    escaped = false;
  const candidates: Record<string, unknown>[] = [];
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (start < 0) {
      if (c === '{') {
        start = i;
        depth = 1;
      }
      continue;
    }
    if (quoted) {
      if (escaped) escaped = false;
      else if (c === '\\') escaped = true;
      else if (c === '"') quoted = false;
      continue;
    }
    if (c === '"') quoted = true;
    else if (c === '{') depth++;
    else if (c === '}' && --depth === 0) {
      try {
        const value: unknown = JSON.parse(text.slice(start, i + 1));
        if (object(value)) candidates.push(value);
      } catch {
        /* Invalid candidate is never repaired. */
      }
      start = -1;
    }
  }
  if (candidates.length === 1 && start < 0) return candidates[0];
  // Reflections are text artifacts, not game actions. Accept prose without a JSON wrapper.
  if (
    ['checkpoint', 'reflection', 'batch'].includes(task || '') &&
    text &&
    !/[{}[\]]/.test(text) &&
    !text.startsWith('<')
  )
    return { reflection: text };
  throw new ModelFailure({
    code: 'invalid_json',
    message: '模型返回的 JSON 格式不正确；未执行任何动作',
    retryable: true,
  });
}

function parseProviderObject(
  text: string,
  message: string,
): Record<string, unknown> {
  try {
    const value: unknown = JSON.parse(text);
    if (value && typeof value === 'object' && !Array.isArray(value))
      return value as Record<string, unknown>;
  } catch {
    // The engine's parse error can include the provider's raw response.
  }
  throw new ModelFailure({ code: 'invalid_json', message, retryable: true });
}

export interface CompletionBody {
  id?: string;
  status?: string;
  stop_reason?: string;
  incomplete_details?: { reason?: string };
  output?: Array<{ content?: Array<{ type?: string; text?: string }> }>;
  content?: Array<{ type?: string; text?: string }>;
  choices?: Array<{ message?: { content?: string }; finish_reason?: string }>;
  usage?: Record<string, number>;
}

export async function readChatStream(
  response: Response,
  onProgress?: () => void,
): Promise<CompletionBody> {
  if (!response.body)
    throw new ModelFailure({
      code: 'empty_response',
      message: '流式接口没有返回数据',
      retryable: true,
    });
  const reader = response.body.getReader(),
    decoder = new TextDecoder();
  let buffer = '',
    content = '',
    id: string | undefined,
    finish: string | undefined,
    ended = false,
    received = 0;
  let usage: Record<string, number> | undefined;
  const event = (block: string) => {
    const data = block
      .split('\n')
      .filter((line) => line.startsWith('data:'))
      .map((line) => line.slice(5).trimStart())
      .join('\n')
      .trim();
    if (!data) return;
    if (data === '[DONE]') {
      ended = true;
      return;
    }
    const chunk = parseProviderObject(data, '接口返回了损坏的流式数据') as {
      id?: unknown;
      error?: unknown;
      usage?: Record<string, number>;
      choices?: Array<{
        index?: number;
        delta?: { content?: string; reasoning_content?: string };
        finish_reason?: string;
      }>;
    };
    if (chunk.error)
      throw new ModelFailure({
        code: 'network',
        message: '接口在流式生成过程中报告错误；请检查服务商状态',
        retryable: true,
      });
    id = providerRequestId(chunk.id) || id;
    usage = chunk.usage || usage;
    const choice =
      chunk.choices?.find((c) => c.index === 0) || chunk.choices?.[0];
    if (
      [choice?.delta?.content, choice?.delta?.reasoning_content].some(
        (text) => typeof text === 'string' && text.trim().length > 0,
      )
    )
      onProgress?.();
    if (typeof choice?.delta?.content === 'string')
      content += choice.delta.content;
    if (choice?.finish_reason) finish = choice.finish_reason;
  };
  try {
    while (!ended) {
      const { value, done } = await reader.read();
      if (done) {
        buffer += decoder.decode();
        break;
      }
      received += value.byteLength;
      if (received > 8 * 1024 * 1024)
        throw new ModelFailure({
          code: 'truncated',
          message: '流式响应超过 8 MB 限制，请降低输出预算',
          retryable: false,
        });
      buffer += decoder.decode(value, { stream: true });
      let match: RegExpExecArray | null;
      while ((match = /\r?\n\r?\n/.exec(buffer))) {
        event(buffer.slice(0, match.index).replace(/\r\n/g, '\n'));
        buffer = buffer.slice(match.index + match[0].length);
      }
    }
    if (buffer.trim()) event(buffer.replace(/\r\n/g, '\n'));
    if (!ended && !finish)
      throw new ModelFailure({
        code: 'network',
        message: '流式连接提前断开，未收到完成标记；未执行不完整结果',
        retryable: true,
      });
    return {
      id,
      usage,
      choices: [{ message: { content }, finish_reason: finish }],
    };
  } catch (error) {
    if (error instanceof ModelFailure) {
      error.details.requestId = id;
      if (usage)
        error.details.usage = {
          inputTokens: usage.prompt_tokens ?? usage.input_tokens ?? 0,
          outputTokens: usage.completion_tokens ?? usage.output_tokens ?? 0,
        };
    }
    throw error;
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}

// Count actual decoded transport bytes, including chunked bodies and false headers.
export async function readBoundedJson(
  response: Response,
  limit: number,
  signal?: AbortSignal,
): Promise<Record<string, unknown>> {
  if (!response.body)
    throw new ModelFailure({
      code: 'empty_response',
      message: '接口没有返回数据',
      retryable: true,
    });
  const reader = response.body.getReader();
  // A fixed buffer also bounds overhead from arbitrarily many tiny chunks.
  const bytes = new Uint8Array(limit);
  let received = 0;
  const abort = () => {
    void reader.cancel().catch(() => {});
  };
  signal?.addEventListener('abort', abort, { once: true });
  try {
    signal?.throwIfAborted();
    while (true) {
      const { value, done } = await reader.read();
      signal?.throwIfAborted();
      if (done) break;
      received += value.byteLength;
      if (received > limit)
        throw new ModelFailure({
          code: 'truncated',
          message: '接口响应超过字节限制，请降低输出预算或联系供应商',
          retryable: false,
        });
      bytes.set(value, received - value.byteLength);
    }
    const text = new TextDecoder().decode(bytes.subarray(0, received));
    if (!text.trim())
      throw new ModelFailure({
        code: 'empty_response',
        message: '接口没有返回数据',
        retryable: true,
      });
    return parseProviderObject(text, '接口返回的 JSON 格式不正确');
  } finally {
    signal?.removeEventListener('abort', abort);
    void reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}

// A bounded reference supports correlation without persisting provider text.
export function providerRequestId(value: unknown): string | undefined {
  return typeof value === 'string' &&
    value.length <= 128 &&
    /^[A-Za-z0-9][A-Za-z0-9_.:-]*$/.test(value)
    ? value
    : undefined;
}

export async function providerRequestReference(
  id: string | undefined,
  apiKey: string,
): Promise<string | undefined> {
  const value = providerRequestId(id);
  if (!value || value.includes(apiKey.trim())) return;
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(value),
  );
  return (
    'ref-' +
    Array.from(new Uint8Array(digest).subarray(0, 12), (byte) =>
      byte.toString(16).padStart(2, '0'),
    ).join('')
  );
}
