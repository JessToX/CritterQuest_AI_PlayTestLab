import assert from 'node:assert/strict';
import test from 'node:test';
import { packRecord, unpackRecord } from '../../lib/records/codec.ts';
void test('large records compress and round-trip without removing events', () => {
  const r = {
    events: Array.from({ length: 5000 }, (_, i) => ({
      id: i,
      text: '玩家抽到普通骨头，完成本次操作。'.repeat(5),
    })),
  };
  const packed = packRecord(r);
  assert.ok(JSON.stringify(packed).length < JSON.stringify(r).length / 4);
  assert.deepEqual(unpackRecord(packed), r);
  assert.deepEqual(unpackRecord({ legacy: true }), { legacy: true });
});
