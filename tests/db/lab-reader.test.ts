import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import test, { type TestContext } from 'node:test';
import {
  LabRecordReadError,
  readRecordPage,
  readStoredRecord,
} from '../../db/lab-reader.ts';

function fixture(t: TestContext) {
  const sqlite = new DatabaseSync(':memory:');
  t.after(() => sqlite.close());
  for (const migration of [
    '0000_flippant_lilith',
    '0001_hesitant_longshot',
    '0002_record_chunks',
  ]) {
    sqlite.exec(readFileSync(`drizzle/${migration}.sql`, 'utf8'));
  }
  let reads = 0;
  // Execute the actual read SQL against SQLite using D1's bind/all interface.
  const db = {
    prepare(query: string) {
      return {
        bind(...bindings: SQLInputValue[]) {
          return {
            async all() {
              reads++;
              return { results: sqlite.prepare(query).all(...bindings) };
            },
          };
        },
      };
    },
  } as unknown as D1Database;
  const record = sqlite.prepare(
    'INSERT INTO lab_records (id, kind, value, updated_at) VALUES (?, ?, ?, ?)',
  );
  const piece = sqlite.prepare(
    'INSERT INTO lab_record_chunks (record_id, revision, part, value) VALUES (?, ?, ?, ?)',
  );
  return {
    db,
    record,
    piece,
    reads: () => reads,
  };
}

void test('record page keeps its ordered record slots and reads only the selected revision', async (t) => {
  const { db, record, piece, reads } = fixture(t);
  record.run('missing-other-kind', 'memory', '{', 20);
  for (let i = 0; i < 21; i++) {
    const id = String(i).padStart(2, '0');
    const value =
      i === 20 ? { recordChunks: 1, revision: 'new', count: 2 } : { i };
    record.run(id, 'game', JSON.stringify(value), 1);
  }
  piece.run('20', 'old', 0, '{"i":19}');
  piece.run('20', 'new', 1, '20}');
  piece.run('20', 'new', 0, '{"i":');
  assert.deepEqual(
    await readRecordPage(db, 'game', 0),
    Array.from({ length: 20 }, (_, index) => ({ i: 20 - index })),
  );
  assert.equal(reads(), 1);
  assert.deepEqual(await readRecordPage(db, 'game', 20), [{ i: 0 }]);
  assert.deepEqual((await readStoredRecord(db, '20', 'game'))?.value, {
    i: 20,
  });
  assert.equal(await readStoredRecord(db, '20', 'memory'), undefined);
});

void test('missing or out-of-sequence parts fail explicitly, even when another record is readable', async (t) => {
  const { db, record, piece } = fixture(t);
  record.run('plain', 'game', '{"status":"paused"}', 0);
  record.run(
    'chunked',
    'game',
    '{"recordChunks":1,"revision":"a","count":2}',
    1,
  );
  piece.run('chunked', 'a', 0, '{"status":');
  await assert.rejects(readRecordPage(db, 'game', 0), LabRecordReadError);
  piece.run('chunked', 'a', 2, '"paused"}');
  await assert.rejects(readStoredRecord(db, 'chunked', 'game'), /分片不完整/);
  assert.deepEqual((await readStoredRecord(db, 'plain', 'game'))?.value, {
    status: 'paused',
  });
});

void test('a damaged record returns a fixed diagnostic', async (t) => {
  const { db, record } = fixture(t);
  record.run('damaged', 'game', '{', 0);
  await assert.rejects(readRecordPage(db, 'game', 0), {
    message: '本地记录已损坏，请保留备份并重试',
  });
});
