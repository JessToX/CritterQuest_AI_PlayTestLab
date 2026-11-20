import assert from 'node:assert/strict';
import test from 'node:test';
import { createGame, startTurn } from '../../lib/game/engine.ts';
import { UNSUPPORTED_RELEASE_VERSION } from '../../lib/game/registry.ts';
import { newRecord } from '../../lib/playtest/record.ts';
import { isOfficialGame, isOfficialRule } from '../../lib/rules/scope.ts';
import { validateConfig } from '../../lib/rules/validate.ts';
import { BASE_RULE } from '../../lib/rules/versions.ts';
import { seats } from '../fixtures/playtest.ts';

void test('official saves and their experiment parameters are accepted', () => {
  const rule = {
    ...BASE_RULE,
    config: { ...BASE_RULE.config, ordersToWin: 2 as const, foodLimit: 0 },
  };
  const record = newRecord(seats.slice(0, 2), rule, 71, 'simulation');
  const restored = JSON.parse(JSON.stringify(record));
  assert.ok(isOfficialRule(restored.rule));
  assert.ok(isOfficialGame(restored));
  assert.equal(startTurn(restored.state).config.ordersToWin, 2);
  assert.equal(startTurn(restored.state).config.foodLimit, 0);
  assert.deepEqual(validateConfig(restored.rule.config), rule.config);
});

void test('a different version cannot use formal mechanics to bypass the release boundary', () => {
  const otherId = 'synthetic-unsupported-rule';
  const record = newRecord(seats.slice(0, 2), BASE_RULE, 71, 'simulation');
  assert.equal(isOfficialRule({ ...record.rule, id: otherId }), false);
  assert.equal(
    isOfficialRule({ ...record.rule, text: 'synthetic foreign text' }),
    false,
  );
  assert.equal(
    isOfficialGame({ ...record, engineVersion: 'other-engine' }),
    false,
  );
  assert.equal(
    isOfficialGame({
      ...record,
      state: { ...record.state, ruleVersion: otherId },
    }),
    false,
  );
  assert.throws(
    () =>
      newRecord(
        seats.slice(0, 2),
        { ...BASE_RULE, id: otherId },
        71,
        'simulation',
      ),
    { message: UNSUPPORTED_RELEASE_VERSION },
  );
  assert.throws(() => createGame(['A', 'B'], 71, BASE_RULE.config, otherId), {
    message: UNSUPPORTED_RELEASE_VERSION,
  });
  assert.throws(() => startTurn({ ...record.state, ruleVersion: otherId }), {
    message: UNSUPPORTED_RELEASE_VERSION,
  });
  assert.throws(
    () => validateConfig({ ...BASE_RULE.config, mechanics: undefined }),
    { message: UNSUPPORTED_RELEASE_VERSION },
  );
});
