import assert from 'node:assert/strict';
import test from 'node:test';
import { requestModel } from '../../lib/agents/model.ts';
import { apiCall } from '../../lib/client/model-call.ts';
import { POST } from '../../app/api/agents/respond/route.ts';
import { publicChatInput } from '../../lib/playtest/public-chat.ts';
import { newRecord } from '../../lib/playtest/record.ts';
import { seats, shortRule } from '../fixtures/playtest.ts';
import { protocols } from '../../lib/agents/protocols.ts';
const secret = 'SYNTHETIC_TRANSPORT_SECRET';
const publicData = {
  speak: true,
  message: '这轮该先保留食物，还是尝试完成订单？',
};

void test('real client/route/provider serialization keeps public task stateless and uses fixed protocol', async () => {
  const original = globalThis.fetch;
  const seat = structuredClone(seats[0]);
  seat.profile.customInstructions = secret;
  seat.profile.memorySnapshotId = secret;
  const input = publicChatInput(
    newRecord(seats.slice(0, 2), shortRule, 5, 'api'),
    0,
  );
  const browserBodies: string[] = [],
    publicBodies: string[] = [];
  let reply: Record<string, unknown> = publicData;
  globalThis.fetch = async (url, init) => {
    assert.equal(typeof init?.body, 'string');
    const raw = init!.body as string;
    if (url === '/api/agents/respond') {
      browserBodies.push(raw);
      return POST(
        new Request('https://lab.test/api/agents/respond', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: raw,
        }),
      );
    }
    publicBodies.push(raw);
    const body = JSON.parse(raw);
    const system = body.instructions || body.system || body.messages[0].content;
    assert.ok(system.startsWith(protocols.chat));
    assert.ok(!raw.includes(secret));
    assert.ok(!('previous_response_id' in body));
    const content = JSON.stringify(reply);
    return Response.json(
      body.input !== undefined
        ? { output: [{ content: [{ type: 'output_text', text: content }] }] }
        : body.system
          ? { content: [{ type: 'text', text: content }] }
          : { choices: [{ message: { content } }] },
    );
  };
  try {
    const result = await apiCall(seat, 'chat', input);
    assert.deepEqual(result.data, publicData);
    assert.ok(browserBodies.every((x) => !x.includes(secret)));
    // Even a direct adapter caller cannot replace the public system protocol.
    for (const kind of ['openai', 'anthropic', 'openai-compatible'] as const) {
      const r = await requestModel(
        { ...seat.connection, kind },
        'mock',
        secret,
        input,
        undefined,
        { task: 'chat' },
      );
      assert.deepEqual(r.data, publicData);
    }
    // Accidental private/public response crossing never becomes free public prose.
    reply = { actionId: 'a', reason: secret, publicMessage: secret };
    const swapped = await apiCall(seat, 'chat', input);
    assert.deepEqual(swapped.data, { speak: false, message: '' });
    const count = publicBodies.length;
    await assert.rejects(
      apiCall(seat, 'chat', { ...input, memories: [secret] }),
      /公开桌聊输入/,
    );
    assert.equal(publicBodies.length, count);
  } finally {
    globalThis.fetch = original;
  }
});

void test('private model publicMessage is discarded and public response cannot become a private decision', async () => {
  const original = globalThis.fetch;
  let data: Record<string, unknown> = {
    actionId: 'a',
    reason: secret,
    publicMessage: secret,
    message: secret,
  };
  globalThis.fetch = async () =>
    Response.json({
      choices: [{ message: { content: JSON.stringify(data) } }],
    });
  try {
    const decision = await requestModel(
      seats[0].connection,
      'mock',
      'private protocol',
      { memories: [secret] },
      undefined,
      { task: 'decision' },
    );
    assert.equal(decision.data.reason, secret);
    assert.equal(decision.data.publicMessage, '');
    assert.equal(decision.data.message, undefined);
    data = publicData;
    const crossed = await requestModel(
      seats[0].connection,
      'mock',
      'private protocol',
      {},
      undefined,
      { task: 'decision' },
    );
    assert.equal(crossed.data.actionId, undefined);
    assert.equal(crossed.data.message, undefined);
    assert.equal(crossed.data.publicMessage, '');
  } finally {
    globalThis.fetch = original;
  }
});
