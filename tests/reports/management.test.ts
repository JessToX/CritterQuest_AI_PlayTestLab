import { Packer } from 'docx';
import { strFromU8, unzipSync } from 'fflate';
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  deleteSelectedMemories,
  enrichMemory,
} from '../../lib/memory/management.ts';
import { memoryKey } from '../../lib/memory/selection.ts';
import type { MemoryEntry } from '../../lib/memory/types.ts';
import { newRecord } from '../../lib/playtest/record.ts';
import { type Seat } from '../../lib/playtest/types.ts';
import { reportDocument } from '../../lib/reports/docx.ts';
import { BASE_RULE } from '../../lib/rules/versions.ts';
const seats: Seat[] = [0, 1].map((i) => ({
  enabled: true,
  profile: {
    id: 's' + i,
    name: 'AI ' + i,
    model: 'm',
    providerId: 'p',
    customInstructions: '',
    memoryMode: 'active',
  },
  connection: {
    id: 'p',
    label: '供应商',
    kind: 'openai-compatible',
    baseUrl: 'https://example.com',
    apiKey: 'NEVER_EXPORT_SECRET',
  },
}));
void test('historical author snapshot survives source deletion and renaming', () => {
  const game = newRecord(seats, BASE_RULE, 1, 'api');
  const m: MemoryEntry = {
    id: 'm',
    agentId: memoryKey(seats[0], BASE_RULE.id, 'api'),
    ruleVersion: BASE_RULE.id,
    kind: 'episode',
    content: 'original',
    active: true,
    createdAt: '',
    sourceGameIds: [game.id],
  };
  const upgraded = enrichMemory(m, [game]);
  assert.equal(upgraded.author?.name, 'AI 0');
  assert.equal(upgraded.mode, 'api');
  game.seats[0].name = 'renamed';
  assert.equal(enrichMemory(upgraded, [game]).author?.name, 'AI 0');
  assert.equal(enrichMemory(upgraded, []).author?.name, 'AI 0');
  assert.equal(enrichMemory(m, []).author?.name, '历史信息缺失');
});
void test('Word contains complete recorded events, conversation, authors and edits but no key', async () => {
  const game = newRecord(seats, BASE_RULE, 1, 'api');
  game.title = '自定义报告标题';
  game.notes = '人工备注保留';
  game.status = 'terminated';
  game.terminationReason = '用户结束';
  game.reflections[game.state.players[0].id] = 'AI原始反思'.repeat(200);
  game.chat = Array.from({ length: 45 }, (_, turn) => ({
    speaker: 'AI 0',
    message: '公开内容' + turn,
    turn,
  }));
  const bytes = await Packer.toBuffer(reportDocument([game]));
  const xml = strFromU8(unzipSync(bytes)['word/document.xml']);
  for (const value of [
    '自定义报告标题',
    '人工备注保留',
    'AI原始反思'.repeat(200),
    '公开内容44',
    '已终止',
    '供应商',
  ])
    assert.ok(xml.includes(value));
  assert.ok(!xml.includes('NEVER_EXPORT_SECRET'));
  for (const e of game.state.events) assert.ok(xml.includes(e.publicText));
  assert.ok(xml.includes('tblHeader'));
  assert.ok(
    strFromU8(unzipSync(bytes)['word/styles.xml']).includes('Songti SC'),
  );
});

void test('bulk deletion touches only selected memories and preserves failed entries for retry', async () => {
  const memories = ['a', 'b', 'c', 'untouched'].map(
    (id) => ({ id }) as MemoryEntry,
  );
  const stored = new Set(memories.map((m) => m.id));
  const result = await deleteSelectedMemories(
    memories.slice(0, 3),
    async (m) => {
      if (m.id === 'b') throw new Error('offline');
      stored.delete(m.id);
    },
  );
  assert.deepEqual(result, { deleted: 2, failures: ['b'] });
  assert.deepEqual([...stored], ['b', 'untouched']);
  const retry = await deleteSelectedMemories(
    memories.filter((m) => result.failures.includes(m.id)),
    async (m) => {
      stored.delete(m.id);
    },
  );
  assert.equal(retry.deleted, 1);
  assert.deepEqual([...stored], ['untouched']);
});
