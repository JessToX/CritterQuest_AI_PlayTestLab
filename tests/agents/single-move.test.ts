import assert from 'node:assert/strict';
import test from 'node:test';
import { createSingleMoveHandler } from '../../app/api/agents/single-move/handler.ts';
import { configureLocalModelFetch } from '../../lib/agents/model.ts';

const origin = 'http://localhost:3000';
const sample = { model: 'sample-model', apiKey: 'dummy-key-for-tests' };
const request = (body = sample, from = origin) =>
  new Request(origin + '/api/agents/single-move', {
    method: 'POST',
    headers: { Origin: from, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
const completion = (actionId: string) =>
  Response.json({
    choices: [
      {
        finish_reason: 'stop',
        message: { content: JSON.stringify({ actionId, reason: 'private' }) },
      },
    ],
  });

void test('only one concurrent or replayed request reaches DeepSeek, and the model choice is applied', async () => {
  const handle = createSingleMoveHandler();
  let calls = 0;
  let secondChoice = '';
  configureLocalModelFetch(async (url, init) => {
    calls++;
    assert.equal(url, 'https://api.deepseek.com/chat/completions');
    assert.equal(init?.redirect, 'manual');
    assert.equal(typeof init?.body, 'string');
    const payload = JSON.parse(init!.body as string);
    assert.equal(payload.model, sample.model);
    assert.equal(payload.stream, false);
    assert.equal(payload.max_tokens, 512);
    const input = JSON.parse(payload.messages[1].content);
    assert.deepEqual(input.relevantMemories, []);
    assert.deepEqual(input.publicChat, []);
    assert.equal(input.customInstructions, '');
    assert.ok(JSON.stringify(input).length < 12000);
    secondChoice = input.legalActions[1].label;
    return completion(input.legalActions[1].id);
  });
  const responses = await Promise.all([handle(request()), handle(request())]);
  const accepted = responses.find((response) => response.status === 200)!;
  assert.ok(secondChoice);
  assert.deepEqual(await accepted.json(), {
    code: 'accepted',
    action: secondChoice,
  });
  const blocked = responses.find((response) => response.status === 409)!;
  assert.deepEqual(await blocked.json(), { code: 'used' });
  assert.equal((await handle(request())).status, 409);
  assert.equal(calls, 1);
});

void test('an invalid action or upstream failure consumes the one-shot budget without leaking context', async () => {
  for (const [category, reply] of [
    ['invalid_action', () => completion('not-legal')],
    [
      'timeout',
      () => {
        throw new DOMException('private details', 'TimeoutError');
      },
    ],
    ['authentication', () => new Response('private details', { status: 401 })],
    ['rate_limit', () => new Response('private details', { status: 429 })],
  ] as const) {
    const handle = createSingleMoveHandler();
    let calls = 0;
    configureLocalModelFetch(async () => {
      calls++;
      return reply();
    });
    const response = await handle(request());
    assert.equal(response.status, 502);
    assert.deepEqual(await response.json(), { code: category });
    assert.equal((await handle(request())).status, 409);
    assert.equal(calls, 1);
  }
});

void test('cross-origin and invalid configuration are rejected before the one-shot budget is used', async () => {
  const handle = createSingleMoveHandler();
  let calls = 0;
  configureLocalModelFetch(async () => {
    calls++;
    return completion('1');
  });
  assert.equal(
    (await handle(request(sample, 'https://example.test'))).status,
    403,
  );
  assert.equal(
    (await handle(request({ ...sample, model: 'https://example.test' })))
      .status,
    400,
  );
  assert.equal(calls, 0);
  assert.equal((await handle(request())).status, 200);
  assert.equal(calls, 1);
});
