import assert from 'node:assert/strict';
import test from 'node:test';
import { readBoundedJson } from '../../lib/agents/response.ts';
import { validatePublicChatInput } from '../../lib/agents/public-output.ts';
import { requestModel, listModels } from '../../lib/agents/model.ts';
import { seats } from '../fixtures/playtest.ts';

void test('JSON counts actual UTF-8 bytes and cancels on excess irrespective of headers', async () => {
  for (const length of [undefined, '1', '999999999']) {
    let cancelled = false;
    const response = new Response(
      new ReadableStream({
        start(c) {
          c.enqueue(new TextEncoder().encode('"中文"'));
        },
        cancel() {
          cancelled = true;
        },
      }),
      { headers: length ? { 'Content-Length': length } : {} },
    );
    await assert.rejects(readBoundedJson(response, 7), /字节限制/);
    assert.ok(cancelled);
    assert.equal(response.body!.locked, false);
  }
  const response = new Response(
    new ReadableStream({
      start(c) {
        c.enqueue(Uint8Array.of(34, 0xe4));
        c.enqueue(Uint8Array.of(0xb8, 0xad, 34));
        c.close();
      },
    }),
  );
  await assert.rejects(readBoundedJson(response, 5), {
    name: 'ModelFailure',
    message: '接口返回的 JSON 格式不正确',
  });
  const object = new Response(
    new ReadableStream({
      start(c) {
        c.enqueue(new TextEncoder().encode('{"text":"'));
        c.enqueue(Uint8Array.of(0xe4));
        c.enqueue(Uint8Array.of(0xb8, 0xad, 34, 125));
        c.close();
      },
    }),
  );
  assert.deepEqual(await readBoundedJson(object, 16), { text: '中' });
});
void test('both provider endpoints cancel oversized chunked bodies', async () => {
  const original = globalThis.fetch;
  try {
    for (const task of ['decision', 'models']) {
      let cancelled = false;
      globalThis.fetch = async () =>
        new Response(
          new ReadableStream({
            start(c) {
              c.enqueue(new Uint8Array(9 * 1024 * 1024));
            },
            cancel() {
              cancelled = true;
            },
          }),
          { headers: { 'Content-Length': '2' } },
        );
      await assert.rejects(
        task === 'models'
          ? listModels(seats[0].connection)
          : requestModel(seats[0].connection, 'mock', 'JSON', {}, undefined, {
              task,
            }),
        /字节限制/,
      );
      assert.ok(cancelled);
    }
    globalThis.fetch = async () =>
      Response.json({ data: [{ id: 'b' }, { id: 'a' }] });
    assert.deepEqual(await listModels(seats[0].connection), ['a', 'b']);
    globalThis.fetch = async () =>
      Response.json({
        choices: [
          {
            message: {
              content: JSON.stringify({
                actionId: 'a',
                publicMessage: 'SECRET',
                reason: 'PRIVATE',
              }),
            },
          },
        ],
      });
    const r = await requestModel(
      seats[0].connection,
      'mock',
      'JSON',
      {},
      undefined,
      { task: 'decision' },
    );
    assert.equal(r.data.reason, 'PRIVATE');
    assert.ok(!JSON.stringify(r.data.publicMessage).includes('SECRET'));
    const chat = await requestModel(
      seats[0].connection,
      'mock',
      'JSON',
      validatePublicChatInput({
        channel: 'public-table-v1',
        speaker: 'A',
        rulebook: 'public',
        tableText: '{}',
        publicChat: [],
      }),
      undefined,
      { task: 'chat' },
    );
    assert.ok(!JSON.stringify(chat.data).includes('PRIVATE'));
    assert.ok(!JSON.stringify(chat.data).includes('SECRET'));
  } finally {
    globalThis.fetch = original;
  }
});
