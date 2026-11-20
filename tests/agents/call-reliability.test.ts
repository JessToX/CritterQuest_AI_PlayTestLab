import assert from 'node:assert/strict';
import test from 'node:test';
import { ModelFailure } from '../../lib/agents/diagnostics.ts';
import { requestModel } from '../../lib/agents/model.ts';
import {
  parseModelContent,
  readChatStream,
} from '../../lib/agents/response.ts';
import { newRecord } from '../../lib/playtest/record.ts';
import { runGame } from '../../lib/playtest/run-game.ts';
import { type Seat } from '../../lib/playtest/types.ts';
import { BASE_RULE } from '../../lib/rules/versions.ts';
import { POST as connectionTest } from '../../app/api/providers/test/route.ts';
const connection = {
  id: 'mock',
  label: 'Mock',
  kind: 'openai-compatible' as const,
  baseUrl: 'https://example.com/v1',
  apiKey: 'TEST_KEY',
};
function stream(text: string, split = 7) {
  const bytes = new TextEncoder().encode(text);
  let i = 0;
  return new Response(
    new ReadableStream({
      pull(controller) {
        if (i >= bytes.length) controller.close();
        else {
          controller.enqueue(bytes.slice(i, i + split));
          i += split;
        }
      },
    }),
    { headers: { 'content-type': 'text/event-stream' } },
  );
}
void test('stream joins split UTF-8, ignores reasoning and preserves final usage', async () => {
  const response = stream(
    ': heartbeat\r\n\r\ndata: ' +
      JSON.stringify({
        id: 'stream-1',
        choices: [
          { index: 0, delta: { reasoning_content: 'private reasoning' } },
        ],
      }) +
      '\r\n\r\n' +
      ['{"actionId":', '"a1","reason":"鱼"}']
        .map(
          (content) =>
            'data: ' +
            JSON.stringify({ choices: [{ index: 0, delta: { content } }] }) +
            '\n\n',
        )
        .join('') +
      'data: ' +
      JSON.stringify({
        choices: [{ index: 0, delta: {}, finish_reason: 'stop' }],
        usage: { prompt_tokens: 99, completion_tokens: 20 },
      }) +
      '\n\ndata: [DONE]\n\n',
    1,
  );
  const result = await readChatStream(response);
  assert.equal(result.id, 'stream-1');
  assert.equal(result.usage?.completion_tokens, 20);
  assert.equal(
    result.choices?.[0].message?.content,
    '{"actionId":"a1","reason":"鱼"}',
  );
});
void test('incomplete stream cannot execute even syntactically valid JSON', async () => {
  await assert.rejects(
    () =>
      readChatStream(
        stream(
          'data: ' +
            JSON.stringify({
              choices: [{ delta: { content: '{"actionId":"a1"}' } }],
            }) +
            '\n\n',
        ),
      ),
    (e) => e instanceof ModelFailure && e.details.code === 'network',
  );
});
void test('stream accepts finish marker without DONE and detects error frames', async () => {
  const result = await readChatStream(
    stream(
      'data: ' +
        JSON.stringify({
          choices: [{ delta: { content: 'ok' }, finish_reason: 'stop' }],
        }) +
        '\n\n',
    ),
  );
  assert.equal(result.choices?.[0].message?.content, 'ok');
  await assert.rejects(
    () =>
      readChatStream(
        stream('data: {"error":{"message":"secret provider details"}}\n\n'),
      ),
    (e) => e instanceof ModelFailure && !e.message.includes('secret'),
  );
});
void test('only an unambiguous complete JSON object is extracted from prose', () => {
  assert.deepEqual(
    parseModelContent(
      '这里是结果：\n```json\n{"actionId":"a1","reason":"brace } and \\\" quote"}\n```',
    ),
    { actionId: 'a1', reason: 'brace } and " quote' },
  );
  assert.throws(
    () => parseModelContent('{"actionId":"a1"}\n{"actionId":"a2"}'),
    ModelFailure,
  );
  assert.throws(
    () => parseModelContent('我选择动作 a1', 'decision'),
    ModelFailure,
  );
  assert.throws(
    () => parseModelContent('[{"actionId":"a1"}]', 'decision'),
    ModelFailure,
  );
  assert.throws(
    () => parseModelContent('{"actionId":"a1"', 'decision'),
    ModelFailure,
  );
});
void test('plain Chinese reflections are accepted, malformed JSON decisions are not repaired', () => {
  assert.deepEqual(
    parseModelContent(
      '策略：保留普通骨头。\n不确定：对手任务未知。',
      'reflection',
    ),
    { reflection: '策略：保留普通骨头。\n不确定：对手任务未知。' },
  );
  assert.throws(
    () => parseModelContent('{"actionId": "a1",}', 'decision'),
    ModelFailure,
  );
});
void test('compatible calls request streaming; ignored streaming still supports JSON response', async () => {
  const old = globalThis.fetch;
  let payload: Record<string, unknown> = {};
  globalThis.fetch = async (_url, init) => {
    payload = JSON.parse(init?.body as string);
    return Response.json({
      choices: [{ message: { content: '{"ok":true}' } }],
    });
  };
  try {
    assert.equal(
      (await requestModel(connection, 'mock', 'JSON', {})).data.ok,
      true,
    );
    assert.equal(payload.stream, true);
    await requestModel(connection, 'mock', 'JSON', {}, undefined, {
      settings: { stream: false },
    });
    assert.equal(payload.stream, false);
  } finally {
    globalThis.fetch = old;
  }
});
void test('summary protocol removes JSON-only mode and keeps returned text', async () => {
  const old = globalThis.fetch;
  globalThis.fetch = async (_url, init) => {
    const body = JSON.parse(init?.body as string);
    assert.equal(body.response_format, undefined);
    return stream(
      'data: ' +
        JSON.stringify({
          choices: [
            {
              delta: { content: '本局经验：应保留用于技能的鱼。' },
              finish_reason: 'stop',
            },
          ],
        }) +
        '\n\n',
    );
  };
  try {
    assert.equal(
      (
        await requestModel(connection, 'mock', 'Summarize', {}, undefined, {
          task: 'reflection',
        })
      ).data.reflection,
      '本局经验：应保留用于技能的鱼。',
    );
  } finally {
    globalThis.fetch = old;
  }
});
void test('HTTP 504 identifies upstream host and does not claim local deadline was reached', async () => {
  const old = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response('', { status: 504, headers: { 'retry-after': '60' } });
  try {
    await assert.rejects(
      () => requestModel(connection, 'mock', 'JSON', {}),
      (e) =>
        e instanceof ModelFailure &&
        e.details.status === 504 &&
        e.details.timeoutMs === 180000 &&
        e.details.retryAfterMs === 60000 &&
        e.message.includes('上游网关 example.com'),
    );
  } finally {
    globalThis.fetch = old;
  }
});
void test('provider connection test reports actual authentication error', async () => {
  const old = globalThis.fetch;
  globalThis.fetch = async () => new Response('', { status: 401 });
  try {
    const response = await connectionTest(
      new Request('http://localhost/api/providers/test', {
        method: 'POST',
        body: JSON.stringify({ connection, model: 'mock' }),
      }),
    );
    const body = (await response.json()) as {
      details: { status: number; timeoutMs: number };
      error: string;
    };
    assert.equal(body.details.status, 401);
    assert.equal(body.details.timeoutMs, 30000);
    assert.match(body.error, /鉴权/);
  } finally {
    globalThis.fetch = old;
  }
});
void test('retry waiting is visible and cancellation preserves the game without a second call', async () => {
  const seats: Seat[] = [0, 1].map((i) => ({
    enabled: true,
    connection,
    profile: {
      id: 's' + i,
      name: 'S' + i,
      model: 'mock',
      providerId: 'mock',
      customInstructions: '',
      memoryMode: 'disabled',
    },
  }));
  const controller = new AbortController();
  let calls = 0,
    waitShown = false;
  const r = await runGame(newRecord(seats, BASE_RULE, 1, 'api'), seats, [], {
    signal: controller.signal,
    maxCalls: 100,
    chat: false,
    save: async () => {},
    saveMemory: async () => {},
    onUpdate: (g) => {
      if (g.retryWait) {
        waitShown = true;
        assert.equal(g.retryWait.nextAttempt, 2);
        controller.abort();
      }
    },
    call: async () => {
      calls++;
      throw new ModelFailure({
        code: 'http',
        status: 504,
        message: 'gateway timeout',
        retryable: true,
        retryAfterMs: 60000,
      });
    },
  });
  assert.ok(waitShown);
  assert.equal(calls, 1);
  assert.equal(r.status, 'paused');
  assert.equal(r.retryWait, undefined);
  assert.equal(r.decisions?.length, 0);
});

void test('gateway 504 is counted as timeout in historical analytics', async () => {
  const { analytics } = await import('../../lib/reports/analytics.ts');
  const seats: Seat[] = [0, 1].map((i) => ({
    enabled: true,
    connection,
    profile: {
      id: 's' + i,
      name: 'S' + i,
      model: 'mock',
      providerId: 'mock',
      customInstructions: '',
      memoryMode: 'disabled',
    },
  }));
  const g = newRecord(seats, BASE_RULE, 1, 'api');
  g.calls = [
    {
      seatId: 's0',
      task: 'decision',
      turn: 1,
      latencyMs: 61900,
      inputTokens: 0,
      outputTokens: 0,
      error: '模型请求失败（HTTP 504）',
      details: {
        code: 'http',
        status: 504,
        message: 'gateway',
        retryable: true,
      },
    },
  ];
  assert.equal(analytics([g]).models[0].timeouts, 1);
});

void test('HTTP failures release response bodies and ignore invalid Retry-After', async () => {
  const original = globalThis.fetch;
  let cancelled = false;
  globalThis.fetch = async () =>
    new Response(
      new ReadableStream({
        cancel() {
          cancelled = true;
        },
      }),
      { status: 504, headers: { 'retry-after': 'invalid date' } },
    );
  try {
    await assert.rejects(
      () => requestModel(connection, 'model', 'test', {}),
      (error) => {
        assert.ok(error instanceof ModelFailure);
        assert.equal(error.details.status, 504);
        assert.equal(error.details.retryAfterMs, undefined);
        assert.equal(cancelled, true);
        return true;
      },
    );
  } finally {
    globalThis.fetch = original;
  }
});
