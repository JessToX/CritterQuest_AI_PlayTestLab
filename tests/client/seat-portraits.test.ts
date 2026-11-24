import assert from 'node:assert/strict';
import test from 'node:test';
import {
  resolvePortrait,
  selectablePortraits,
  seatTone,
} from '../../lib/client/seat-portraits.ts';
import { newRecord } from '../../lib/playtest/record.ts';
import { BASE_RULE } from '../../lib/rules/versions.ts';
import { seats } from '../fixtures/playtest.ts';

void test('new games keep each participating seat’s portrait at creation', () => {
  const selected = [1, 3].map((i) => ({
    ...seats[i],
    profile: { ...seats[i].profile, id: `seat-${i}` },
  }));
  const choices = new Map([
    ['seat-1', 'whale'],
    ['seat-3', 'humpback-navigator'],
  ]);
  const game = newRecord(
    selected,
    BASE_RULE,
    7,
    'simulation',
    undefined,
    (id) => resolvePortrait(choices.get(id)),
  );
  choices.set('seat-1', 'owl');
  choices.delete('seat-3');
  assert.deepEqual(
    game.seats.map((s) => [seatTone(s.id), s.portrait]),
    [
      [1, 'geometric'],
      [3, 'humpback-navigator'],
    ],
  );
});

void test('retired portraits display the geometric default without changing saved seat IDs', () => {
  assert.equal(Object.hasOwn(selectablePortraits, 'whale'), false);
  const saved = { id: 'seat-3', portrait: 'whale' };
  assert.equal(resolvePortrait(saved.portrait), 'geometric');
  assert.equal(seatTone(saved.id), 3);
  assert.equal(saved.portrait, 'whale');
  for (const choice of Object.keys(selectablePortraits)) {
    assert.equal(resolvePortrait(choice), choice);
  }
});

void test('missing and unknown saved choices fall back to the original seat art', () => {
  for (const value of [undefined, null, '', 'toString', 'unknown'])
    assert.equal(resolvePortrait(value), 'geometric');
  assert.equal(seatTone('seat-3', 1), 3);
  assert.equal(seatTone('legacy-id', 1), 1);
});
