import assert from 'node:assert/strict';
import test from 'node:test';
import {
  forgetKeys,
  rememberKeys,
  restoreHistoricalKeys,
} from '../../lib/client/saved-keys.ts';
import { newRecord } from '../../lib/playtest/record.ts';
import { needsResumeInput, resumeSeats } from '../../lib/playtest/resume.ts';
import { runGame } from '../../lib/playtest/run-game.ts';
import { simulationCall } from '../../lib/playtest/simulation.ts';
import { type Seat } from '../../lib/playtest/types.ts';
import { BASE_RULE } from '../../lib/rules/versions.ts';
const original: Seat[] = [0, 1].map((i) => ({
  enabled: true,
  profile: {
    id: 's' + i,
    name: 'Old ' + i,
    providerId: 'custom',
    model: 'old-model',
    memoryMode: 'active',
    customInstructions: 'old instructions',
  },
  connection: {
    id: 'custom',
    label: 'Old provider',
    kind: 'openai-compatible',
    baseUrl: 'https://old.example/v1',
    apiKey: 'old-secret',
  },
}));
function storage() {
  const data = new Map<string, string>();
  return {
    getItem: (k: string) => data.get(k) || null,
    setItem: (k: string, v: string) => {
      data.set(k, v);
    },
    removeItem: (k: string) => {
      data.delete(k);
    },
  } as Storage;
}
void test('resume restores historical setup and keys after new setup without mutating it', async () => {
  const rule = { ...BASE_RULE, config: { ...BASE_RULE.config, maxRounds: 1 } };
  const old = newRecord(original, rule, 1, 'api');
  old.status = 'paused';
  const current = original.map((s) => ({
    ...s,
    profile: {
      ...s.profile,
      model: 'new-model',
      customInstructions: 'new',
      memoryMode: 'disabled' as const,
    },
    connection: {
      ...s.connection,
      baseUrl: 'https://new.example/v1',
      apiKey: 'new-secret',
    },
  }));
  const store = storage();
  rememberKeys(original, store);
  rememberKeys(current, store);
  const restored = restoreHistoricalKeys(old, resumeSeats(old, current), store);
  assert.equal(restored[0].profile.model, 'old-model');
  assert.equal(restored[0].profile.customInstructions, 'old instructions');
  assert.equal(restored[0].profile.memoryMode, 'active');
  assert.equal(restored[0].connection.apiKey, 'old-secret');
  assert.equal(current[0].profile.model, 'new-model');
  assert.equal(current[0].connection.apiKey, 'new-secret');
  assert.equal(JSON.stringify(old).includes('old-secret'), false);
  const result = await runGame(
    { ...old, mode: 'simulation' },
    resumeSeats({ ...old, mode: 'simulation' }, current),
    [],
    {
      call: simulationCall,
      save: async () => {},
      saveMemory: async () => {},
      onUpdate: () => {},
      signal: new AbortController().signal,
      maxCalls: 100,
      chat: false,
    },
  );
  assert.equal(result.id, old.id);
  assert.equal(result.status, 'complete');
  forgetKeys(store);
  assert.ok(
    needsResumeInput(
      restoreHistoricalKeys(old, resumeSeats(old, current), store),
      'api',
    ),
  );
});
void test('legacy fingerprint restores original endpoint and does not reuse new provider key', () => {
  const old = newRecord(original, BASE_RULE, 1, 'api');
  old.seats.forEach((s) => delete s.connection);
  const current = original.map((s) => ({
    ...s,
    connection: {
      ...s.connection,
      baseUrl: 'https://new.example/v1',
      apiKey: 'new-secret',
    },
  }));
  const restored = resumeSeats(old, current);
  assert.equal(restored[0].connection.baseUrl, 'https://old.example/v1');
  assert.equal(restored[0].connection.apiKey, '');
  const store = storage();
  rememberKeys(original, store);
  assert.equal(
    restoreHistoricalKeys(old, restored, store)[0].connection.apiKey,
    '',
  );
});
void test('unknown legacy custom endpoint requires explicit input instead of guessing', () => {
  const old = newRecord(original, BASE_RULE, 1, 'api');
  old.seats.forEach((s) => {
    delete s.connection;
    delete s.connectionFingerprint;
    s.provider = '自定义兼容 API';
  });
  const current = original.map((s) => ({
    ...s,
    connection: { ...s.connection, label: '自定义兼容 API' },
  }));
  const restored = resumeSeats(old, current);
  assert.equal(restored[0].connection.apiKey, '');
  assert.equal(restored[0].connection.baseUrl, '');
  assert.ok(needsResumeInput(restored, 'api'));
  assert.equal(needsResumeInput(restored, 'simulation'), false);
});

void test('a malformed historical provider ID requires explicit credentials', () => {
  const game = newRecord(original, BASE_RULE, 1, 'api');
  Object.assign(game.seats[0].connection!, { id: 42 });
  const restored = resumeSeats(game, original);
  assert.equal(restored[0].connection.id, 'custom');
  assert.equal(restored[0].connection.baseUrl, original[0].connection.baseUrl);
  assert.equal(restored[0].connection.apiKey, '');
  const store = storage();
  rememberKeys(original, store);
  assert.equal(
    restoreHistoricalKeys(game, restored, store)[0].connection.apiKey,
    '',
  );
  assert.equal(needsResumeInput(restored, 'api'), true);
});
