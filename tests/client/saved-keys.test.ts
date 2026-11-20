import assert from 'node:assert/strict';
import test from 'node:test';
import {
  forgetKeys,
  rememberKeys,
  restoreKeys,
} from '../../lib/client/saved-keys.ts';
import type { Seat } from '../../lib/playtest/types.ts';

void test('saved keys survive reload, remain bound to seat and endpoint, and can be cleared', () => {
  const data = new Map<string, string>();
  const storage = {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => {
      data.set(k, v);
    },
    removeItem: (k: string) => {
      data.delete(k);
    },
  } as Storage;
  const seat = {
    profile: { id: 'seat-0' },
    connection: {
      id: 'custom',
      kind: 'openai-compatible',
      baseUrl: 'https://example.com/v1',
      apiKey: 'test-secret',
    },
  } as Seat;
  rememberKeys([seat], storage);
  const empty = { ...seat, connection: { ...seat.connection, apiKey: '' } };
  assert.equal(
    restoreKeys([empty], storage)[0].connection.apiKey,
    'test-secret',
  );
  assert.equal(
    restoreKeys(
      [
        {
          ...empty,
          connection: {
            ...empty.connection,
            baseUrl: 'https://other.example/v1',
          },
        },
      ],
      storage,
    )[0].connection.apiKey,
    '',
  );
  assert.equal(
    restoreKeys(
      [{ ...empty, profile: { ...empty.profile, id: 'seat-1' } }],
      storage,
    )[0].connection.apiKey,
    '',
  );
  forgetKeys(storage);
  assert.equal(restoreKeys([empty], storage)[0].connection.apiKey, '');
  rememberKeys([empty], storage);
  assert.equal(
    [...data.values()].some((value) => value.includes('test-secret')),
    false,
  );
});
