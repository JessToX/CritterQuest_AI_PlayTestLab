import assert from 'node:assert/strict';
import test from 'node:test';
import { failureDetails, ModelFailure } from '../../lib/agents/diagnostics.ts';
import { requestModel } from '../../lib/agents/model.ts';
import { seats } from '../fixtures/playtest.ts';
void test('model adapter preserves HTTP classification and retry-after with a bounded request reference', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response('', {
      status: 429,
      headers: { 'retry-after': '3', 'x-request-id': 'req-1' },
    });
  try {
    await assert.rejects(
      () => requestModel(seats[0].connection, 'mock', 'JSON', {}),
      (error) =>
        error instanceof ModelFailure &&
        error.details.code === 'http' &&
        error.details.retryAfterMs === 3000 &&
        /^ref-[0-9a-f]{24}$/.test(error.details.requestId ?? '') &&
        error.details.retryable,
    );
  } finally {
    globalThis.fetch = original;
  }
});
void test('response truncation is reported separately from malformed JSON and preserves usage', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () =>
    Response.json({
      choices: [{ message: { content: '{' }, finish_reason: 'length' }],
      usage: { prompt_tokens: 8, completion_tokens: 256 },
    });
  try {
    await assert.rejects(
      () => requestModel(seats[0].connection, 'mock', 'JSON', {}),
      (error) =>
        error instanceof ModelFailure &&
        error.details.code === 'truncated' &&
        error.details.usage?.outputTokens === 256,
    );
  } finally {
    globalThis.fetch = original;
  }
});
void test('model reading deadline is distinct from user cancellation', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(new ReadableStream(), {
      headers: { 'x-request-id': 'slow-body' },
    });
  try {
    await assert.rejects(
      () =>
        requestModel(seats[0].connection, 'mock', 'JSON', {}, undefined, {
          task: 'decision',
          settings: { decisionTimeoutSeconds: 1 },
        }),
      (error) =>
        error instanceof ModelFailure &&
        error.details.code === 'timeout' &&
        error.details.phase === 'reading' &&
        /^ref-[0-9a-f]{24}$/.test(error.details.requestId ?? '') &&
        error.details.timeoutMs === 1000,
    );
    const controller = new AbortController();
    const pending = requestModel(
      seats[0].connection,
      'mock',
      'JSON',
      {},
      controller.signal,
    );
    setTimeout(() => controller.abort(), 5);
    await assert.rejects(
      () => pending,
      (error) =>
        error instanceof ModelFailure &&
        error.details.code === 'cancelled' &&
        !error.details.retryable,
    );
  } finally {
    globalThis.fetch = original;
  }
});

void test('malformed and empty outer responses carry fixed, retryable diagnostics', async (t) => {
  const fetchMock = t.mock.method(globalThis, 'fetch');
  for (const [makeResponse, code, message] of [
    [() => new Response('{'), 'invalid_json', '接口返回的 JSON 格式不正确'],
    [() => new Response(''), 'empty_response', '接口没有返回数据'],
    [() => Response.json(null), 'invalid_json', '接口返回的 JSON 格式不正确'],
  ] as const) {
    fetchMock.mock.mockImplementation(async () => makeResponse());
    await assert.rejects(
      () => requestModel(seats[0].connection, 'mock', 'JSON', {}),
      (error) =>
        error instanceof ModelFailure &&
        error.details.code === code &&
        error.details.message === message &&
        error.details.retryable,
    );
  }
  assert.equal(
    failureDetails(new Error('sample note')).message,
    '模型调用失败，原因未确定',
  );
});

void test('provider references are stable and absent for unusable IDs', async (t) => {
  const connection = seats[0].connection;
  const fetchMock = t.mock.method(globalThis, 'fetch');
  const response = (id: unknown) =>
    Response.json({
      id,
      choices: [{ message: { content: '{"actionId":"a"}' } }],
    });
  fetchMock.mock.mockImplementation(async () => response('req-ordinary'));
  const call = () => requestModel(connection, 'mock', 'JSON', {});
  const first = await call();
  assert.match(first.requestId ?? '', /^ref-[0-9a-f]{24}$/);
  assert.equal((await call()).requestId, first.requestId);
  for (const id of [
    undefined,
    123,
    'a'.repeat(129),
    'multiple words',
    connection.apiKey,
  ]) {
    fetchMock.mock.mockImplementation(async () => response(id));
    assert.equal((await call()).requestId, undefined);
  }
});
