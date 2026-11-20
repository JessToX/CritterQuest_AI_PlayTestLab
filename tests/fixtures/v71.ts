import assert from 'node:assert/strict';
import {
  createGame,
  applyAction,
  legalActions,
  startTurn,
} from '../../lib/game/engine.ts';
import { isFood } from '../../lib/game/engines/v71.ts';
import { marketState } from '../../lib/game/market-types.ts';
import type { MarketCard } from '../../lib/game/market-types.ts';
import type { FoodCard, GameAction, GameState } from '../../lib/game/types.ts';

export function fixture(count = 2, seed = 71) {
  const state = createGame(['A', 'B', 'C', 'D'].slice(0, count), seed);
  state.activePlayerIndex = 0;
  return startTurn(state);
}
export function take(state: GameState, id: string): MarketCard {
  const m = marketState(state);
  for (const pile of [
    m.deck,
    m.discard,
    m.market,
    ...state.players.map((p) => p.questRow),
  ]) {
    const index = pile.findIndex((c) => c.id === id);
    if (index >= 0) return pile.splice(index, 1)[0];
  }
  throw new Error(`Missing card ${id}`);
}
export function market(state: GameState, ...ids: string[]) {
  const m = marketState(state);
  m.deck.push(...m.market.splice(0));
  m.market.push(...ids.map((id) => take(state, id)));
  m.refreshAvailable = m.market.length > 0 && !m.market.some(isFood);
  return state;
}
export function top(state: GameState, ...ids: string[]) {
  const cards = ids.map((id) => take(state, id));
  marketState(state).deck.push(...cards.reverse());
  return state;
}
export function give(state: GameState, index: number, ...ids: string[]) {
  const cards = ids.map((id) => take(state, id));
  assert.ok(cards.every(isFood));
  state.players[index].questRow.push(...(cards as FoodCard[]));
  return state;
}
export function coins(state: GameState, index: number, amount: number) {
  const m = marketState(state),
    account = m.accounts[state.players[index].id];
  m.bank += account.coins - amount;
  account.coins = amount;
}
export function act(
  state: GameState,
  type: GameAction['type'],
  predicate: (action: GameAction) => boolean = () => true,
) {
  const candidate = legalActions(state).find(
    (a) => a.action.type === type && predicate(a.action),
  );
  assert.ok(
    candidate,
    `Missing ${type}: ${JSON.stringify(legalActions(state))}`,
  );
  const before = JSON.stringify(state),
    result = applyAction(state, candidate.action);
  assert.equal(JSON.stringify(state), before, 'immutable action');
  assert.deepEqual(
    JSON.parse(JSON.stringify(result)),
    JSON.parse(
      JSON.stringify(applyAction(JSON.parse(before), candidate.action)),
    ),
    'serialized boundary',
  );
  return result;
}
export function buy(
  state: GameState,
  cardId: string,
  recipientId = 'player-1',
) {
  return act(
    state,
    'buy',
    (a) =>
      a.type === 'buy' && a.cardId === cardId && a.recipientId === recipientId,
  );
}
export function invariant(state: GameState) {
  const m = marketState(state);
  const cards = [
    ...m.deck,
    ...m.discard,
    ...m.market,
    ...state.players.flatMap((p) => p.questRow),
    ...m.pending.flatMap((step) => ('card' in step ? [step.card] : [])),
  ];
  assert.equal(cards.length, 79);
  assert.equal(new Set(cards.map((c) => c.id)).size, 79);
  assert.equal(cards.filter(isFood).length, 48);
  const accounts = Object.values(m.accounts);
  assert.equal(m.bank + accounts.reduce((n, a) => n + a.coins, 0), 40);
  assert.ok(
    m.bank >= 0 &&
      accounts.every((a) => Number.isInteger(a.coins) && a.coins >= 0),
  );
  const orders = [
    ...m.orders,
    ...m.orderDeck,
    ...accounts.flatMap((a) => a.completedOrders),
  ];
  assert.equal(orders.length, 12);
  assert.equal(new Set(orders.map((o) => o.id)).size, 12);
  assert.ok(m.market.length <= 5 && m.orders.length <= 3);
  for (const p of state.players) {
    assert.equal(p.character, null);
    assert.equal(p.mission, null);
    assert.equal(p.hand.length, 0);
    assert.ok(p.questRow.every((c) => c.variant === 'normal'));
  }
  assert.equal(
    state.deck.length + state.discard.length + state.pending.length,
    0,
  );
  if (state.status === 'complete')
    assert.equal(
      m.accounts[state.winnerId!].completedOrders.length,
      m.ordersToWin,
    );
}
