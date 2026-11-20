import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import {
  createGame,
  DEFAULT_CONFIG,
  legalActions,
  applyAction,
  startTurn,
  visibleStateFor,
} from '../../lib/game/engine.ts';
import {
  createMainCards,
  createOrders,
  isFood,
  marketDecisionView,
} from '../../lib/game/engines/v71.ts';
import { marketState } from '../../lib/game/market-types.ts';
import { validateConfig } from '../../lib/rules/validate.ts';
import { BASE_RULE } from '../../lib/rules/versions.ts';
import { marketSimulationAction } from '../../lib/playtest/market-simulation.ts';
import {
  act,
  buy,
  coins,
  fixture,
  give,
  invariant,
  market,
  top,
} from '../fixtures/v71.ts';

void test('V7.1 official snapshot, 79-card inventory, symmetric Q01–Q12 and defaults are pinned', () => {
  assert.deepEqual(
    JSON.parse(readFileSync('rules/compiled/final-v7.1.json', 'utf8')),
    BASE_RULE,
  );
  assert.equal(BASE_RULE.id, 'final-v7.1');
  assert.deepEqual(validateConfig(DEFAULT_CONFIG), DEFAULT_CONFIG);
  const cards = createMainCards(),
    orders = createOrders();
  assert.equal(cards.length, 79);
  assert.equal(cards.filter(isFood).length, 48);
  for (const event of ['super', 'rotten', 'fresh'])
    assert.equal(
      cards.filter((c) => !isFood(c) && c.event === event).length,
      4,
    );
  for (const [amount, count] of [
    [3, 4],
    [2, 5],
    [1, 6],
    [-1, 2],
    [-2, 1],
    [-3, 1],
  ])
    assert.equal(
      cards.filter((c) => !isFood(c) && c.amount === amount).length,
      count,
    );
  assert.equal(
    new Set(orders.map((o) => JSON.stringify(o.requirements))).size,
    12,
  );
  assert.deepEqual(orders[0].requirements, {
    seed: 2,
    fish: 1,
    bone: 1,
    cheese: 0,
  });
  assert.deepEqual(orders[11].requirements, {
    seed: 0,
    fish: 1,
    bone: 1,
    cheese: 2,
  });
  for (const food of ['seed', 'fish', 'bone', 'cheese'] as const)
    assert.equal(
      orders.reduce((n, o) => n + o.requirements[food], 0),
      12,
    );
  for (const patch of [
    { copies: { normal: 13, super: 0, rotten: 0 } },
    { ordersToWin: 1 },
    { patterns: ['4'] },
    { foodLimit: 3 },
  ])
    assert.throws(() => validateConfig({ ...DEFAULT_CONFIG, ...patch }));
});

void test('2–4 player setup deals only two ordinary foods, three coins, five market cards and three public orders', () => {
  assert.throws(() => createGame(['A']), /2–4/);
  assert.throws(() => createGame(['A', 'B', 'C', 'D', 'E']), /2–4/);
  for (const n of [2, 3, 4]) {
    const s = createGame(['A', 'B', 'C', 'D'].slice(0, n), 71),
      m = marketState(s);
    assert.deepEqual(s, createGame(['A', 'B', 'C', 'D'].slice(0, n), 71));
    assert.ok(s.players.every((p) => p.questRow.length === 2));
    assert.equal(m.bank, 40 - 3 * n);
    assert.equal(m.market.length, 5);
    assert.equal(m.orders.length, 3);
    assert.equal(m.deck.length, 79 - 2 * n - 5);
    assert.equal(m.discard.length, 0);
    invariant(s);
    const next = startTurn(s);
    assert.equal(next.phase, 'buy');
    assert.equal(next.players[0].questRow.length, 2);
    assert.equal(next.events.filter((e) => e.type === 'draw').length, 0);
  }
});

void test('purchases cost 3/2 coins, refill before acquisition and give Fresh choices to the recipient', () => {
  let s = market(
    fixture(),
    'fresh-1',
    'coins-1-1',
    'coins-1-2',
    'coins-1-3',
    'coins-1-4',
  );
  top(s, 'seed-normal-12');
  s = buy(s, 'fresh-1', 'player-2');
  const m = marketState(s);
  assert.equal(m.accounts['player-1'].coins, 1);
  assert.equal(s.decisionPlayerId, 'player-2');
  assert.ok(legalActions(s).every((a) => a.action.type === 'fresh_swap'));
  assert.ok(
    legalActions(s).some(
      (a) =>
        a.action.type === 'fresh_swap' &&
        a.action.marketCardId === 'seed-normal-12',
    ),
  );
  const deckCount = m.deck.length,
    marketCount = m.market.length;
  s = act(s, 'fresh_swap');
  assert.equal(marketState(s).deck.length, deckCount);
  assert.equal(marketState(s).market.length, marketCount);
  assert.equal(s.phase, 'buy');
  assert.equal(s.decisionPlayerId, 'player-1');
  invariant(s);
});

void test('no credit or refunds; coin rewards can fund more buys only during the buy phase', () => {
  let s = market(fixture(), 'coins-3-1', 'rotten-1', 'seed-normal-12');
  coins(s, 0, 1);
  assert.ok(!legalActions(s).some((a) => a.action.type === 'buy'));
  coins(s, 0, 2);
  s = buy(s, 'coins-3-1');
  assert.equal(marketState(s).accounts['player-1'].coins, 3);
  assert.ok(
    legalActions(s).some(
      (a) => a.action.type === 'buy' && a.action.cardId === 'seed-normal-12',
    ),
  );
  marketState(s).deck.push(...s.players[1].questRow.splice(0));
  s = buy(s, 'rotten-1', 'player-2');
  assert.equal(marketState(s).accounts['player-1'].coins, 1);
  assert.equal(s.phase, 'buy');
  top(s, 'coins-3-2');
  s = act(act(s, 'end_buy'), 'skip_order');
  assert.equal(s.phase, 'order_after');
  assert.equal(marketState(s).accounts['player-1'].coins, 4);
  assert.ok(!legalActions(s).some((a) => a.action.type === 'buy'));
  invariant(s);
});

void test('bank rewards clip to supply and penalties to zero without debt', () => {
  let s = market(fixture(), 'coins-3-1', 'coins--3-1');
  coins(s, 0, 2);
  coins(s, 1, 38);
  s = buy(s, 'coins-3-1');
  assert.equal(marketState(s).accounts['player-1'].coins, 2);
  assert.equal(marketState(s).bank, 0);
  s = buy(s, 'coins--3-1');
  assert.equal(marketState(s).accounts['player-1'].coins, 0);
  assert.equal(marketState(s).bank, 2);
  invariant(s);
});

void test('Rotten recipient must choose their own food; interleaved buys, orders and skips are rejected', () => {
  let s = market(fixture(), 'rotten-1');
  s = buy(s, 'rotten-1', 'player-2');
  assert.equal(s.decisionPlayerId, 'player-2');
  const ids = new Set(s.players[1].questRow.map((c) => c.id));
  assert.ok(
    legalActions(s).every(
      (a) => a.action.type === 'rotten_discard' && ids.has(a.action.cardId),
    ),
  );
  for (const action of [
    { type: 'end_buy' },
    { type: 'skip_order' },
    { type: 'submit_order', orderId: 'Q01' },
  ] as const)
    assert.throws(() => applyAction(s, action), /非法/);
  s = act(s, 'rotten_discard');
  assert.equal(s.players[1].questRow.length, 1);
  assert.equal(s.phase, 'buy');
  invariant(s);
});

void test('Fresh can swap identical foods, cannot swap events and is mandatory when both sides have food', () => {
  let s = market(fixture(), 'fresh-1', 'seed-normal-12', 'super-1');
  give(s, 0, 'seed-normal-11');
  s = buy(s, 'fresh-1');
  assert.ok(
    legalActions(s).every(
      (a) =>
        a.action.type === 'fresh_swap' && a.action.marketCardId !== 'super-1',
    ),
  );
  s = act(
    s,
    'fresh_swap',
    (a) =>
      a.type === 'fresh_swap' &&
      a.foodId === 'seed-normal-11' &&
      a.marketCardId === 'seed-normal-12',
  );
  assert.ok(s.players[0].questRow.some((c) => c.id === 'seed-normal-12'));
  assert.ok(marketState(s).market.some((c) => c.id === 'seed-normal-11'));
  invariant(s);
});

void test('nested Super keeps both event cards out of reshuffles and returns all choices to its recipient', () => {
  let s = market(fixture(), 'super-1');
  top(s, 'seed-normal-12', 'super-2', 'rotten-1');
  s = buy(s, 'super-1', 'player-2');
  let m = marketState(s);
  assert.equal(s.decisionPlayerId, 'player-2');
  assert.deepEqual(
    m.pending.map((p) => p.kind),
    ['rotten_choice', 'discard_event', 'discard_event'],
  );
  assert.deepEqual(
    m.pending.flatMap((p) => ('card' in p ? [p.card.id] : [])),
    ['rotten-1', 'super-2', 'super-1'],
  );
  assert.ok(!m.discard.some((c) => c.id === 'super-1' || c.id === 'super-2'));
  invariant(s);
  s = act(s, 'rotten_discard');
  m = marketState(s);
  assert.deepEqual(
    m.discard.slice(-3).map((c) => c.id),
    ['rotten-1', 'super-2', 'super-1'],
  );
  assert.equal(s.phase, 'buy');
  top(s, 'fish-normal-12');
  s = act(act(s, 'end_buy'), 'skip_order');
  assert.equal(
    s.events.filter(
      (e) => e.payload?.v71 === 'draw' && e.payload.source === 'normal',
    ).length,
    1,
  );
  assert.equal(
    s.events.filter(
      (e) => e.payload?.v71 === 'draw' && e.payload.source === 'super',
    ).length,
    2,
  );
  invariant(s);
});

void test('empty synthetic piles do not recycle a purchased or unresolved Super or remember missed draws', () => {
  let s = fixture(),
    m = marketState(s);
  m.market = [{ id: 'held-super', event: 'super' }];
  m.deck = [];
  m.discard = [];
  s = buy(s, 'held-super');
  m = marketState(s);
  assert.equal(m.market.length, 0);
  assert.deepEqual(m.discard, [{ id: 'held-super', event: 'super' }]);
  assert.equal(m.pending.length, 0);
  assert.equal(s.phase, 'buy');
  assert.equal(
    s.events.filter(
      (e) => e.payload?.v71 === 'draw' && e.payload.cardKind === 'empty',
    ).length,
    1,
  );
  // Refill occurs at the next purchasing-stage start, and display never executes Super.
  s.phase = 'start';
  s = startTurn(s);
  assert.equal(marketState(s).market[0].id, 'held-super');
  assert.equal(marketState(s).pending.length, 0);
});

void test('market refresh is free, once, before first purchase, and does not trigger displayed events', () => {
  let s = market(
    fixture(),
    'coins-3-1',
    'super-1',
    'rotten-1',
    'fresh-1',
    'coins--3-1',
  );
  coins(s, 0, 0);
  top(s, 'super-2');
  s = act(s, 'refresh_market');
  assert.equal(marketState(s).accounts['player-1'].coins, 0);
  assert.ok(!legalActions(s).some((a) => a.action.type === 'refresh_market'));
  assert.equal(s.events.filter((e) => e.payload?.v71 === 'super').length, 0);
  assert.equal(marketState(s).refreshAvailable, false);
  invariant(s);
  let last = market(
    fixture(),
    'seed-normal-12',
    'super-1',
    'rotten-1',
    'fresh-1',
    'coins-3-1',
  );
  top(last, 'super-2');
  last = buy(last, 'seed-normal-12');
  assert.ok(!marketState(last).market.some(isFood));
  assert.ok(
    !legalActions(last).some((a) => a.action.type === 'refresh_market'),
  );
  invariant(last);
});

void test('start-of-turn holes are filled before determining refresh eligibility', () => {
  let s = market(fixture(), 'super-1');
  top(s, 'seed-normal-12', 'coins-3-1', 'fresh-1', 'rotten-1');
  s.phase = 'start';
  s = startTurn(s);
  assert.equal(marketState(s).market.length, 5);
  assert.equal(marketState(s).refreshAvailable, false);
  invariant(s);
});

for (const target of [2, 3] as const)
  void test(`${target}th order wins immediately before the draw, without replacement order or cleanup`, () => {
    let s = fixture();
    const m = marketState(s);
    m.ordersToWin = target;
    s.config.ordersToWin = target;
    m.orderDeck.push(...m.orders.splice(0));
    m.orders.push(
      m.orderDeck.splice(
        m.orderDeck.findIndex((o) => o.id === 'Q01'),
        1,
      )[0],
    );
    m.accounts['player-1'].completedOrders.push(
      ...m.orderDeck.splice(0, target - 1),
    );
    give(
      s,
      0,
      'seed-normal-11',
      'seed-normal-12',
      'fish-normal-12',
      'bone-normal-12',
      'cheese-normal-12',
      'cheese-normal-11',
      'cheese-normal-10',
      'cheese-normal-9',
      'cheese-normal-8',
    );
    s = act(s, 'end_buy');
    const beforeDeck = marketState(s).deck.length,
      beforeOrders = marketState(s).orderDeck.length;
    s = act(s, 'submit_order');
    assert.equal(s.winnerId, 'player-1');
    assert.equal(s.status, 'complete');
    assert.equal(marketState(s).deck.length, beforeDeck);
    assert.equal(marketState(s).orderDeck.length, beforeOrders);
    assert.equal(marketState(s).orders.length, 0);
    assert.equal(s.turn, 1);
    assert.equal(legalActions(s).length, 0);
    invariant(s);
  });

void test('a non-winning order consumes four foods, pays no coins and cannot be repeated that turn', () => {
  let s = fixture();
  const m = marketState(s);
  m.orderDeck.push(...m.orders.splice(0));
  m.orders.push(
    m.orderDeck.splice(
      m.orderDeck.findIndex((o) => o.id === 'Q01'),
      1,
    )[0],
  );
  give(
    s,
    0,
    'seed-normal-11',
    'seed-normal-12',
    'fish-normal-12',
    'bone-normal-12',
  );
  top(s, 'cheese-normal-12');
  const count = s.players[0].questRow.length;
  s = act(act(s, 'end_buy'), 'submit_order');
  assert.equal(marketState(s).accounts['player-1'].completedOrders.length, 1);
  assert.equal(marketState(s).accounts['player-1'].coins, 3);
  assert.equal(s.players[0].questRow.length, count - 4 + 1);
  assert.equal(s.phase, 'start');
  assert.equal(s.turn, 2);
  assert.equal(
    s.events.filter(
      (e) => e.payload?.v71 === 'draw' && e.payload.source === 'normal',
    ).length,
    1,
  );
  invariant(s);
});

void test('orders can be completed after the mandatory draw; only the owner cleans up at turn end', () => {
  let s = fixture();
  const m = marketState(s);
  m.orderDeck.push(...m.orders.splice(0));
  m.orders.push(
    m.orderDeck.splice(
      m.orderDeck.findIndex((o) => o.id === 'Q01'),
      1,
    )[0],
  );
  m.deck.push(...s.players[0].questRow.splice(0));
  give(s, 0, 'seed-normal-11', 'seed-normal-12', 'fish-normal-12');
  top(s, 'bone-normal-12');
  give(
    s,
    1,
    'cheese-normal-12',
    'cheese-normal-11',
    'cheese-normal-10',
    'cheese-normal-9',
    'cheese-normal-8',
  );
  s = act(act(s, 'end_buy'), 'skip_order');
  assert.equal(s.phase, 'order_after');
  assert.ok(legalActions(s).some((a) => a.action.type === 'submit_order'));
  s = act(s, 'submit_order');
  assert.equal(s.players[1].questRow.length, 7);
  assert.equal(s.turn, 2);
  invariant(s);
});

void test('gifts and acquisitions may exceed six until the receiver ends their own turn', () => {
  let s = market(fixture(), 'seed-normal-12');
  give(
    s,
    1,
    'cheese-normal-12',
    'cheese-normal-11',
    'cheese-normal-10',
    'cheese-normal-9',
    'cheese-normal-8',
  );
  s = buy(s, 'seed-normal-12', 'player-2');
  assert.equal(s.players[1].questRow.length, 8);
  assert.equal(s.phase, 'buy');
  top(s, 'fish-normal-12');
  s = act(act(act(s, 'end_buy'), 'skip_order'), 'skip_order');
  assert.equal(s.players[1].questRow.length, 8);
  s = startTurn(s);
  top(s, 'bone-normal-12');
  s = act(act(act(s, 'end_buy'), 'skip_order'), 'skip_order');
  assert.equal(s.phase, 'cleanup');
  while (s.phase === 'cleanup') s = act(s, 'discard');
  assert.equal(s.players[1].questRow.length, 6);
  assert.equal(s.turn, 3);
  invariant(s);
});

void test('public AI view exposes coins, foods and orders without deck order, RNG, roles or hidden missions', () => {
  const s = fixture(),
    view = marketDecisionView(visibleStateFor(s, 'player-1'));
  const json = JSON.stringify(view);
  for (const key of [
    'rngState',
    'initialDeckOrder',
    'orderDeck"',
    '"character"',
    '"mission"',
    'payload',
    'telemetry',
  ])
    assert.ok(!json.includes(key), key);
  assert.ok(json.includes('completedOrders') && json.includes('coins'));
  assert.ok(!JSON.stringify(view).includes('DO_NOT_SAVE'));
  assert.throws(
    () =>
      applyAction(s, { type: 'unsupported' } as unknown as Parameters<
        typeof applyAction
      >[1]),
    /非法/,
  );
});

for (const count of [2, 3, 4])
  void test(`V7.1 ${count} players preserve all 79 cards, 12 orders, 40 coins and legal progression across 12 seeds`, () => {
    let wins = 0;
    for (let seed = 1; seed <= 12; seed++) {
      let s = createGame(['A', 'B', 'C', 'D'].slice(0, count), seed, {
        ...DEFAULT_CONFIG,
        ordersToWin: seed % 2 ? 3 : 2,
        maxRounds: 60,
      });
      let decisions = 0;
      while (s.status === 'active') {
        s = startTurn(s);
        invariant(s);
        const actions = legalActions(s);
        assert.ok(actions.length > 0);
        assert.ok(++decisions < 3000);
        const view = visibleStateFor(s, s.decisionPlayerId!);
        const chosen =
          seed % 3 === 0
            ? actions[(seed * 31 + decisions * 7) % actions.length]
            : marketSimulationAction(
                actions,
                view.marketGame!,
                s.decisionPlayerId!,
              );
        s = applyAction(s, chosen.action);
        invariant(s);
      }
      if (s.winnerId) wins++;
      else assert.equal(s.events.at(-1)?.payload?.v71, 'test_limit');
    }
    assert.ok(wins > 0);
  });
