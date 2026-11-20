import assert from 'node:assert/strict';
import test from 'node:test';
import { load, save, removeRecord } from '../../lib/client/records.ts';
import { packRecord, unpackRecord } from '../../lib/records/codec.ts';
import type { MemoryEntry } from '../../lib/memory/types.ts';

void test('client loads every page and decodes historical plain and compressed records', async (t) => {
  const entry: MemoryEntry = {
    id: 'old',
    agentId: 'a',
    ruleVersion: 'final-v7.1',
    kind: 'episode',
    content: 'old',
    sourceGameIds: [],
    createdAt: '',
    active: true,
  };
  const large = { ...entry, id: 'large', content: '全文'.repeat(120000) };
  const urls: string[] = [];
  t.mock.method(globalThis, 'fetch', async (url: string) => {
    urls.push(url);
    return Response.json(
      url.endsWith('offset=0')
        ? { records: [entry, packRecord(large)], hasMore: true }
        : { records: [{ ...entry, id: 'last' }], hasMore: false },
    );
  });
  assert.deepEqual(await load('memory'), [
    entry,
    large,
    { ...entry, id: 'last' },
  ]);
  assert.deepEqual(urls, [
    '/api/lab?kind=memory&offset=0',
    '/api/lab?kind=memory&offset=20',
  ]);
});
void test('client preserves save/delete wire formats and surfaces persistence errors', async (t) => {
  const entry: MemoryEntry = {
    id: 'm',
    agentId: 'a',
    ruleVersion: 'final-v7.1',
    kind: 'episode',
    content: '全文'.repeat(120000),
    sourceGameIds: [],
    createdAt: '',
    active: true,
  };
  const calls: RequestInit[] = [];
  t.mock.method(
    globalThis,
    'fetch',
    async (_url: string, options: RequestInit) => {
      calls.push(options);
      return Response.json({ ok: true });
    },
  );
  await save(entry.id, 'memory', entry);
  await removeRecord(entry.id, 'memory');
  assert.equal(typeof calls[0].body, 'string');
  assert.equal(typeof calls[1].body, 'string');
  const saved = JSON.parse(calls[0].body as string);
  assert.equal(saved.kind, 'memory');
  assert.equal(saved.id, 'm');
  assert.deepEqual(unpackRecord(saved.value), entry);
  assert.equal(calls[0].method, 'POST');
  assert.equal(calls[1].method, 'DELETE');
  assert.deepEqual(JSON.parse(calls[1].body as string), {
    id: 'm',
    kind: 'memory',
  });
  t.mock.method(globalThis, 'fetch', async () =>
    Response.json({ error: '保存不可用' }, { status: 503 }),
  );
  await assert.rejects(save(entry.id, 'memory', entry), /保存不可用/);
  await assert.rejects(load('memory'), /保存不可用/);
  await assert.rejects(removeRecord(entry.id, 'memory'), /保存不可用/);
});
