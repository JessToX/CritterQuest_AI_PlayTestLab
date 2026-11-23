import assert from 'node:assert/strict';
import test from 'node:test';
import { newRecord } from '../../lib/playtest/record.ts';
import { summarySeats } from '../../lib/playtest/resume.ts';
import { BASE_RULE } from '../../lib/rules/versions.ts';
import { seats } from '../fixtures/playtest.ts';

void test('summary seats follow historical order and configuration while retaining current summary timeout', () => {
  const original = structuredClone(seats.slice(0, 2));
  original[0].profile.modelSettings = {
    summaryTimeoutSeconds: 180,
    maxOutputTokens: 400,
  };
  const game = newRecord(original, BASE_RULE, 1, 'api');
  const current = structuredClone(original);
  current[0].profile.name = 'renamed';
  current[0].profile.customInstructions = 'new instructions';
  current[0].profile.memoryMode = 'disabled';
  current[0].profile.modelSettings = {
    summaryTimeoutSeconds: 300,
    maxOutputTokens: 900,
  };
  current.reverse();
  const before = structuredClone({ game, current });
  const result = summarySeats(game, current)!;
  assert.deepEqual(
    result.map((seat) => seat.profile.id),
    original.map((seat) => seat.profile.id),
  );
  assert.equal(result[0].profile.name, original[0].profile.name);
  assert.equal(
    result[0].profile.customInstructions,
    original[0].profile.customInstructions,
  );
  assert.equal(result[0].profile.memoryMode, original[0].profile.memoryMode);
  assert.deepEqual(result[0].profile.modelSettings, {
    summaryTimeoutSeconds: 300,
    maxOutputTokens: 400,
  });
  assert.equal(result[0].connection.apiKey, 'DO_NOT_SAVE');
  assert.deepEqual({ game, current }, before);
  delete current[1].profile.modelSettings;
  assert.equal(
    summarySeats(game, current)![0].profile.modelSettings
      ?.summaryTimeoutSeconds,
    180,
  );
});

void test('summary repair rejects a missing seat, changed model, changed endpoint or absent API key', () => {
  const game = newRecord(seats.slice(0, 2), BASE_RULE, 1, 'api');
  assert.equal(summarySeats(game, seats.slice(0, 1)), null);
  for (const change of ['model', 'endpoint', 'key', 'provider', 'mode']) {
    const current = structuredClone(seats);
    if (change === 'model') current[0].profile.model = 'other';
    if (change === 'endpoint')
      current[0].connection.baseUrl = 'https://other.example';
    if (change === 'provider') current[0].connection.id = 'other-provider';
    if (change === 'mode') current[0].connection.kind = 'anthropic';
    if (change === 'key') current[0].connection.apiKey = '';
    assert.equal(summarySeats(game, current), null, change);
  }
});

void test('targeted repair validates only the requested player but still requires all historical seats', () => {
  const game = newRecord(seats.slice(0, 2), BASE_RULE, 1, 'api');
  const current = structuredClone(seats.slice(0, 2));
  current[1].profile.model = 'other';
  current[1].connection.apiKey = '';
  const playerId = game.state.players[0].id;
  assert.ok(summarySeats(game, current, playerId));
  assert.equal(summarySeats(game, current), null);
  assert.equal(summarySeats(game, current.slice(0, 1), playerId), null);
});

void test('simulation summary repair needs no key and historical records without fingerprints remain supported', () => {
  const game = newRecord(seats.slice(0, 2), BASE_RULE, 1, 'simulation');
  const current = structuredClone(seats);
  current.forEach((seat) => {
    seat.connection.apiKey = '';
  });
  assert.ok(summarySeats(game, current));
  game.seats.forEach((seat) => {
    delete seat.connectionFingerprint;
  });
  current[0].connection.baseUrl = 'https://other.example';
  assert.ok(summarySeats(game, current));
});

void test('summary repair requires a complete historical identity for API mode and accepts equivalent endpoints', () => {
  const game = newRecord(seats.slice(0, 2), BASE_RULE, 1, 'api');
  const current = structuredClone(seats);
  current[0].connection.baseUrl += '/';
  assert.ok(summarySeats(game, current));
  delete game.seats[0].connection;
  assert.equal(summarySeats(game, current), null);
  delete game.seats[0].connectionFingerprint;
  assert.equal(summarySeats(game, current), null);
  assert.ok(summarySeats({ ...game, mode: 'simulation' }, current));
});
