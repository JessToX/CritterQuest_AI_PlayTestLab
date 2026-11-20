import assert from 'node:assert/strict';
import test from 'node:test';
import { removeRecord, save } from '../../lib/client/records.ts';
import { memoryKey } from '../../lib/memory/selection.ts';
import type { MemoryEntry } from '../../lib/memory/types.ts';
import { newRecord } from '../../lib/playtest/record.ts';
import { unpackRecord } from '../../lib/records/codec.ts';
import { deleteSelectedReports } from '../../lib/reports/management.ts';
import { BASE_RULE } from '../../lib/rules/versions.ts';
import { seats } from '../fixtures/playtest.ts';

// Exercise the same browser adapter wiring while keeping deletion policy
// independent of fetch, storage encoding and the runtime hosting the workflow.
const persistence = {
  saveMemory: (entry: MemoryEntry) => save(entry.id, 'memory', entry),
  removeGame: (id: string) => removeRecord(id, 'game'),
};

function report(id: string) {
  const game = newRecord(seats.slice(0, 2), BASE_RULE, 71, 'simulation');
  game.id = id;
  game.status = 'paused';
  return game;
}
function memory(sourceGameIds: string[]): MemoryEntry {
  return {
    id: 'shared-memory',
    agentId: memoryKey(seats[0], BASE_RULE.id, 'simulation'),
    ruleVersion: BASE_RULE.id,
    kind: 'episode',
    content: '保留 AI 原始反思',
    sourceGameIds,
    createdAt: '',
    active: true,
  };
}

void test('bulk report deletion preserves memory authors before deleting only selected records, once per ID', async (t) => {
  const games = ['a', 'b', 'untouched'].map(report);
  const entry = memory(['a', 'b']);
  const storedGames = new Set(games.map((g) => g.id));
  const requests: string[] = [];
  let storedMemory: MemoryEntry | undefined;
  t.mock.method(
    globalThis,
    'fetch',
    async (_url: string, options: RequestInit) => {
      const body = JSON.parse(options.body as string);
      requests.push(`${options.method} ${body.kind} ${body.id}`);
      if (options.method === 'POST') {
        assert.ok(storedGames.has('a') && storedGames.has('b'));
        storedMemory = unpackRecord(body.value) as MemoryEntry;
      } else {
        assert.equal(storedMemory?.author?.name, seats[0].profile.name);
        storedGames.delete(body.id);
      }
      return Response.json({ ok: true });
    },
  );
  const removed: string[] = [];
  const result = await deleteSelectedReports([games[0], games[1], games[0]], {
    ...persistence,
    games,
    memories: [entry],
    onDeleted: (g) => {
      assert.ok(
        !storedGames.has(g.id),
        'UI updates only after persistence succeeds',
      );
      removed.push(g.id);
    },
  });
  assert.deepEqual(result, { deletedIds: ['a', 'b'], failures: [] });
  assert.deepEqual(removed, ['a', 'b']);
  assert.deepEqual([...storedGames], ['untouched']);
  assert.deepEqual(requests, [
    'POST memory shared-memory',
    'DELETE game a',
    'DELETE game b',
  ]);
  assert.deepEqual(storedMemory?.sourceGameIds, ['a', 'b']);
  assert.equal(storedMemory?.content, entry.content);
  assert.equal(storedMemory?.mode, 'simulation');
  assert.equal(entry.author, undefined, 'source input is unchanged');
});

void test('partial deletion keeps failures available for retry and continues deleting other selected reports', async (t) => {
  const games = ['a', 'b', 'c', 'untouched'].map(report);
  const stored = new Set(games.map((g) => g.id));
  let unavailable = true;
  t.mock.method(
    globalThis,
    'fetch',
    async (_url: string, options: RequestInit) => {
      const { id } = JSON.parse(options.body as string);
      if (id === 'b' && unavailable)
        return Response.json({ error: '数据库暂不可用' }, { status: 503 });
      stored.delete(id);
      return Response.json({ ok: true });
    },
  );
  const removed: string[] = [];
  const options = {
    ...persistence,
    games,
    memories: [],
    onDeleted: (g: ReturnType<typeof report>) => {
      removed.push(g.id);
    },
  };
  const result = await deleteSelectedReports(games.slice(0, 3), options);
  assert.deepEqual(result, {
    deletedIds: ['a', 'c'],
    failures: [{ id: 'b', message: '数据库暂不可用' }],
  });
  assert.deepEqual(removed, ['a', 'c']);
  assert.deepEqual([...stored], ['b', 'untouched']);
  unavailable = false;
  const retry = await deleteSelectedReports(
    games.filter((g) => result.failures.some((f) => f.id === g.id)),
    options,
  );
  assert.deepEqual(retry, { deletedIds: ['b'], failures: [] });
  assert.deepEqual([...stored], ['untouched']);
});

void test('memory persistence failure prevents source deletion without blocking unrelated selected reports', async (t) => {
  const games = ['a', 'b'].map(report);
  const requestedDeletes: string[] = [];
  t.mock.method(
    globalThis,
    'fetch',
    async (_url: string, options: RequestInit) => {
      const body = JSON.parse(options.body as string);
      if (body.kind === 'memory')
        return Response.json({ error: '记忆保存失败' }, { status: 503 });
      requestedDeletes.push(body.id);
      return Response.json({ ok: true });
    },
  );
  const removed: string[] = [];
  const result = await deleteSelectedReports(games, {
    ...persistence,
    games,
    memories: [memory(['a'])],
    onDeleted: (g) => {
      removed.push(g.id);
    },
  });
  assert.deepEqual(result, {
    deletedIds: ['b'],
    failures: [{ id: 'a', message: '记忆保存失败' }],
  });
  assert.deepEqual(requestedDeletes, ['b']);
  assert.deepEqual(removed, ['b']);
});

void test('running reports and server-rejected deletions never disappear from client state', async (t) => {
  const games = ['running', 'stale'].map(report);
  games[0].status = 'running';
  const requests: string[] = [];
  t.mock.method(
    globalThis,
    'fetch',
    async (_url: string, options: RequestInit) => {
      requests.push(JSON.parse(options.body as string).id);
      return Response.json(
        { error: '请先暂停或终止对局再删除' },
        { status: 400 },
      );
    },
  );
  const result = await deleteSelectedReports(games, {
    ...persistence,
    games,
    memories: [],
    onDeleted: () => assert.fail('rejected report must remain visible'),
  });
  assert.deepEqual(requests, ['stale']);
  assert.deepEqual(result.deletedIds, []);
  assert.deepEqual(
    result.failures.map((f) => f.id),
    ['running', 'stale'],
  );
});
