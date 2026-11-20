import assert from 'node:assert/strict';
import test from 'node:test';
import { Packer } from 'docx';
import { strFromU8, unzipSync } from 'fflate';
import { newRecord } from '../../lib/playtest/record.ts';
import { runGame } from '../../lib/playtest/run-game.ts';
import { reportFor } from '../../lib/reports/report.ts';
import { reportDocument } from '../../lib/reports/docx.ts';
import { analytics } from '../../lib/reports/analytics.ts';
import { v71Stats, v71Summary } from '../../lib/reports/v71-stats.ts';
import { BASE_RULE } from '../../lib/rules/versions.ts';
import { seats, opts } from '../fixtures/playtest.ts';
import type { GameEvent } from '../../lib/game/types.ts';

void test('V7.1 JSON and Word export the same event-based market metrics and no obsolete skill section', async () => {
  const r = await runGame(
    newRecord(
      seats.slice(0, 4),
      { ...BASE_RULE, config: { ...BASE_RULE.config, maxRounds: 6 } },
      71,
      'simulation',
    ),
    seats.slice(0, 4),
    [],
    opts(),
  );
  const report = reportFor(r),
    stats = report.v71!;
  assert.ok(stats);
  assert.ok(!('v6' in report));
  assert.ok(!('v52' in report));
  assert.equal(report.ordersToWin, 3);
  assert.equal(report.foodLimit, 6);
  assert.equal(
    stats.foodPurchases + stats.eventPurchases,
    r.state.events.filter((e) => e.payload?.v71 === 'purchase').length,
  );
  assert.equal(
    stats.players.reduce((n, p) => n + p.turns, 0),
    r.state.events.filter((e) => e.payload?.v71 === 'turn_start').length,
  );
  const xml = strFromU8(
    unzipSync(await Packer.toBuffer(reportDocument([r])))['word/document.xml'],
  );
  assert.ok(xml.includes('V7.1 试玩指标'));
  assert.ok(
    !xml.includes('角色能力次数') &&
      !xml.includes('V6 专项指标') &&
      !xml.includes('DO_NOT_SAVE'),
  );
  for (const line of v71Summary(stats)) assert.ok(xml.includes(line));
  const json = JSON.parse(JSON.stringify(report));
  assert.equal(json.v6, undefined);
  assert.equal(json.v71.foodPurchases, stats.foodPurchases);
  assert.ok(!Object.hasOwn(json, 'abilities'));
  assert.ok(!Object.hasOwn(json.players[0], 'character'));
  assert.ok(!Object.hasOwn(json.players[0], 'missionDetails'));
});

void test('V7.1 reports distinguish refresh success, capacity evidence, recipient gifts, personal turns and waiting proxies', () => {
  const event = (
    turn: number,
    actorId: string,
    v71: string,
    extra: Record<string, unknown> = {},
  ): GameEvent => ({
    id: `${v71}-${turn}`,
    turn,
    round: Math.ceil(turn / 2),
    actorId,
    type: 'effect',
    publicText: '',
    payload: { v71, ...extra },
  });
  const stats = v71Stats([
    event(1, 'player-1', 'turn_start', {
      allEventMarket: true,
      affordableCards: 0,
    }),
    event(1, 'player-1', 'refresh', { foodAppeared: true }),
    event(1, 'player-1', 'turn_end'),
    event(3, 'player-1', 'turn_start', {
      allEventMarket: false,
      affordableCards: 1,
    }),
    event(3, 'player-1', 'purchase', {
      cardKind: 'rotten',
      recipientId: 'player-2',
    }),
    event(3, 'player-1', 'order', { orderId: 'Q01', window: 'order_before' }),
    event(3, 'player-1', 'cleanup', {
      cardId: 'seed-normal-1',
      neededForOrders: ['Q02'],
    }),
    event(3, 'player-1', 'cleanup', {
      cardId: 'fish-normal-1',
      neededForOrders: [],
    }),
    event(3, 'player-1', 'turn_end'),
  ]);
  assert.equal(stats.refreshesFindingFood, 1);
  assert.equal(stats.allEventMarketStarts, 1);
  assert.equal(stats.cleanupDiscards, 2);
  assert.equal(stats.cleanupDiscardsNeededForOpenOrders, 1);
  assert.equal(stats.players[0].turnsWithoutBuyOrOrder, 1);
  assert.equal(stats.players[0].completedOrders[0].personalTurn, 2);
  assert.equal(stats.players[0].rottenAttacks, 1);
});

void test('V7.1 analytics never merges standard, quick and no-cap conditions; interrupted games have no winner', () => {
  const standard = newRecord(seats.slice(0, 2), BASE_RULE, 71, 'simulation');
  const quick = newRecord(
    seats.slice(0, 2),
    { ...BASE_RULE, config: { ...BASE_RULE.config, ordersToWin: 2 } },
    71,
    'simulation',
  );
  const unlimited = newRecord(
    seats.slice(0, 2),
    { ...BASE_RULE, config: { ...BASE_RULE.config, foodLimit: 0 } },
    71,
    'simulation',
  );
  assert.equal(analytics([standard, quick, unlimited]).groups.length, 3);
  standard.status = 'terminated';
  standard.terminationReason = '用户提前停止';
  assert.equal(reportFor(standard).winner, '未完成');
  assert.equal(reportFor(standard).terminationReason, '用户提前停止');
  assert.ok(analytics([standard]).groups.every((g) => g.winRate === null));
});
