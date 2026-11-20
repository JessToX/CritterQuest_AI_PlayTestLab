import assert from 'node:assert/strict';
import test from 'node:test';
import { loadWorkspace } from '../../lib/client/workspace.ts';
import type { MemoryEntry } from '../../lib/memory/types.ts';
import { newRecord } from '../../lib/playtest/record.ts';
import { BASE_RULE } from '../../lib/rules/versions.ts';
import { seats } from '../fixtures/playtest.ts';

void test('workspace loads all collections, enriches ordered memories and reports incompatible records', async (t) => {
  const game = newRecord(seats.slice(0, 3), BASE_RULE, 1, 'simulation');
  const entry: MemoryEntry = {
    id: 'newer',
    agentId: 's0|provider|endpoint|mock|rule|simulation',
    ruleVersion: BASE_RULE.id,
    kind: 'episode',
    content: 'memory',
    sourceGameIds: [game.id],
    createdAt: '2026-09-20',
    active: true,
  };
  const collections: Record<string, unknown[]> = {
    game: [game],
    memory: [entry, { ...entry, id: 'older', createdAt: '2026-09-19' }],
    rule: [BASE_RULE],
    profiles: [{ seats }],
    preset: [],
  };
  const requested: string[] = [];
  t.mock.method(globalThis, 'fetch', async (url: string) => {
    const kind = new URL(url, 'http://localhost').searchParams.get('kind')!;
    requested.push(kind);
    return Response.json({
      records: collections[kind],
      hasMore: false,
      unsupported: kind === 'game' ? 3 : 0,
    });
  });
  const workspace = await loadWorkspace([]);
  assert.deepEqual(requested.sort(), [
    'game',
    'memory',
    'preset',
    'profiles',
    'rule',
  ]);
  assert.equal(workspace.unsupported, 3);
  assert.deepEqual(workspace.games, JSON.parse(JSON.stringify([game])));
  assert.deepEqual(
    workspace.memories.map((m) => m.id),
    ['older', 'newer'],
  );
  assert.equal(workspace.memories[0].author?.name, seats[0].profile.name);
  assert.ok(workspace.seats.every((seat) => seat.connection.apiKey === ''));
  assert.equal(seats[0].connection.apiKey, 'DO_NOT_SAVE');
});

void test('workspace falls back to initial seats without retaining keys or mutating defaults', async (t) => {
  t.mock.method(globalThis, 'fetch', async () =>
    Response.json({ records: [], hasMore: false }),
  );
  const workspace = await loadWorkspace(seats);
  assert.equal(workspace.seats.length, seats.length);
  assert.equal(workspace.seats[0].connection.apiKey, '');
  assert.notEqual(workspace.seats[0].connection, seats[0].connection);
  assert.equal(seats[0].connection.apiKey, 'DO_NOT_SAVE');
  assert.deepEqual(workspace.memories, []);
});

void test('workspace rejects partial initialization when any collection fails', async (t) => {
  t.mock.method(globalThis, 'fetch', async (url: string) =>
    url.includes('kind=memory')
      ? Response.json({ error: '读取失败' }, { status: 503 })
      : Response.json({ records: [], hasMore: false }),
  );
  await assert.rejects(loadWorkspace(seats), /读取失败/);
});
