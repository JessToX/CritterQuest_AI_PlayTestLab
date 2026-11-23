import assert from 'node:assert/strict';
import test from 'node:test';
import {
  forgetKeys,
  rememberKeys,
  restoreKeys,
  restoreHistoricalKeys,
} from '../../lib/client/saved-keys.ts';
import { newRecord } from '../../lib/playtest/record.ts';
import { BASE_RULE } from '../../lib/rules/versions.ts';
import { seats as fixtureSeats } from '../fixtures/playtest.ts';
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

void test('only the canonical saved endpoint and exact historical provider can restore a key', () => {
  const data = new Map<string, string>();
  const storage = {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, value);
    },
    removeItem: (key: string) => {
      data.delete(key);
    },
  } as Storage;
  const seat = {
    profile: { id: 'seat-0' },
    connection: {
      id: 'custom',
      kind: 'openai-compatible',
      baseUrl: 'https://example.com/v1',
      apiKey: '',
    },
  } as Seat;
  const legacy = 'critter-quest-api-keys-v1';
  data.set(
    legacy,
    JSON.stringify({
      [JSON.stringify([
        'seat-0',
        'custom',
        'openai-compatible',
        'https://example.com/v1',
      ])]: 'legacy-fixture',
    }),
  );
  assert.equal(restoreKeys([seat], storage)[0].connection.apiKey, '');
  rememberKeys(
    [{ ...seat, connection: { ...seat.connection, apiKey: 'new-fixture' } }],
    storage,
  );
  const equivalent = {
    ...seat,
    connection: { ...seat.connection, baseUrl: 'https://EXAMPLE.com:443/v1/' },
  };
  assert.equal(
    restoreKeys([equivalent], storage)[0].connection.apiKey,
    'new-fixture',
  );
  const history = newRecord(
    [
      {
        ...fixtureSeats[0],
        profile: { ...fixtureSeats[0].profile, ...seat.profile },
        connection: seat.connection,
      },
      fixtureSeats[1],
    ],
    BASE_RULE,
    1,
    'api',
  );
  assert.equal(
    restoreHistoricalKeys(history, [equivalent], storage)[0].connection.apiKey,
    'new-fixture',
  );
  rememberKeys(
    [
      {
        ...seat,
        connection: {
          ...seat.connection,
          id: 'other-provider',
          apiKey: 'other-fixture',
        },
      },
    ],
    storage,
  );
  const other = {
    ...seat,
    connection: { ...seat.connection, id: 'other-provider' },
  };
  assert.equal(
    restoreHistoricalKeys(history, [other], storage)[0].connection.apiKey,
    '',
  );
  assert.equal(
    restoreHistoricalKeys(
      { ...history, seats: [{ ...history.seats[0], connection: undefined }] },
      [equivalent],
      storage,
    )[0].connection.apiKey,
    '',
  );
  forgetKeys(storage);
  assert.equal(data.size, 0);
});
