import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { BASE_RULE, BUILTIN_RULES } from '../../lib/rules/versions.ts';
import { newRecord } from '../../lib/playtest/record.ts';
import { applyAction, legalActions, startTurn } from '../../lib/game/engine.ts';
import { advance } from '../../lib/game/engines/v71/flow.ts';
import { marketState } from '../../lib/game/market-types.ts';
import { seats } from '../fixtures/playtest.ts';
import { fixture, take } from '../fixtures/v71.ts';

void test('V7.1 final runtime and compiled snapshots agree', () => {
  assert.deepEqual(
    JSON.parse(readFileSync('rules/compiled/final-v7.1.json', 'utf8')),
    BASE_RULE,
  );
  assert.equal(BUILTIN_RULES[0], BASE_RULE);
  assert.deepEqual(BUILTIN_RULES, [BASE_RULE]);
  assert.match(BASE_RULE.text, /获币事件先弃牌再领币/);
  assert.doesNotMatch(BASE_RULE.text, /Prototype|试玩/);
});

void test('the official rule snapshot survives JSON restore and continues with its own identity', () => {
  const rule = BASE_RULE;
  const record = newRecord(seats.slice(0, 2), rule, 71, 'simulation');
  const restored = JSON.parse(JSON.stringify(record));
  assert.deepEqual(restored.rule, rule);
  assert.equal(restored.state.ruleVersion, rule.id);
  const started = startTurn(restored.state);
  const action = legalActions(started).find(
    (a) => a.action.type === 'end_buy',
  )!;
  const continued = applyAction(started, action.action);
  assert.equal(continued.ruleVersion, rule.id);
  assert.equal(continued.phase, 'order_before');
  assert.equal(restored.rule.hash, rule.hash);
});

void test('coin event discard occurs before positive payout and after negative payment', () => {
  for (const amount of [3, -3]) {
    const state = fixture();
    const m = marketState(state);
    const card = take(state, `coins-${amount}-1`);
    const account = m.accounts['player-1'];
    let balance = account.coins;
    let observed = false;
    Object.defineProperty(account, 'coins', {
      configurable: true,
      get: () => balance,
      set: (next: number) => {
        assert.equal(
          m.discard.some((c) => c.id === card.id),
          amount > 0,
        );
        balance = next;
        observed = true;
      },
    });
    m.resumePhase = 'buy';
    m.pending.push({ kind: 'acquire', recipientId: 'player-1', card });
    advance(state);
    assert.ok(observed);
    assert.ok(m.discard.some((c) => c.id === card.id));
  }
});
