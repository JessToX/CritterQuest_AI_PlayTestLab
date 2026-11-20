// License scope: V7.1 setup data and engine code are mapped in LICENSE-SCOPE.md.
import { log } from '../../events.ts';
import { random, shuffle } from '../../random.ts';
import { isFood } from '../../market.ts';
import { marketState } from '../../market-types.ts';
import type { GameState } from '../../types.ts';
import {
  V71_CONFIG,
  createMainCards,
  createOrders,
  fillMarket,
} from './cards.ts';

export function createGame(
  names: string[],
  seed = Date.now(),
  config = V71_CONFIG,
  version = 'final-v7.1',
): GameState {
  if (names.length < 2 || names.length > 4)
    throw new Error('V7.1 需要 2–4 位玩家');
  if (
    config.mechanics !== 'v7.1' ||
    config.copies.normal !== 12 ||
    config.copies.super !== 0 ||
    config.copies.rotten !== 0 ||
    config.patterns.length !== 1 ||
    config.patterns[0] !== '2+1+1' ||
    ![2, 3].includes(config.ordersToWin ?? 3) ||
    !Number.isInteger(config.foodLimit) ||
    (config.foodLimit !== 0 &&
      (config.foodLimit < 4 || config.foodLimit > 12)) ||
    !Number.isInteger(config.maxRounds) ||
    config.maxRounds < 1 ||
    config.maxRounds > 200
  )
    throw new Error('V7.1 规则参数超出可执行范围');
  const state: GameState = {
    id: `game-${seed}`,
    ruleVersion: version,
    seed,
    rngState: seed >>> 0,
    round: 1,
    turn: 1,
    activePlayerIndex: 0,
    turnDirection: 1,
    // Legacy containers stay empty; all V7.1 draw/discard cards live in marketGame.
    deck: [],
    discard: [],
    players: names.map((name, i) => ({
      id: `player-${i + 1}`,
      name,
      character: null,
      mission: null,
      hand: [],
      questRow: [],
      abilityReady: false,
      frozen: false,
    })),
    status: 'active',
    events: [],
    config: structuredClone(config),
    phase: 'start',
    pending: [],
    choices: {},
    rottenTriggered: false,
    marketGame: {
      deck: [],
      discard: [],
      market: [],
      orderDeck: [],
      orders: [],
      accounts: {},
      bank: 40 - 3 * names.length,
      ordersToWin: config.ordersToWin ?? 3,
      submittedThisTurn: false,
      refreshAvailable: false,
      resumePhase: 'buy',
      pending: [],
    },
  };
  const m = marketState(state);
  state.activePlayerIndex = Math.floor(random(state) * names.length);
  const all = createMainCards();
  const normal = shuffle(state, all.filter(isFood));
  for (const p of state.players) {
    p.questRow.push(normal.pop()!, normal.pop()!);
    m.accounts[p.id] = { coins: 3, completedOrders: [] };
  }
  m.deck = shuffle(state, [...normal, ...all.filter((c) => !isFood(c))]);
  state.initialDeckOrder = m.deck.map((c) => c.id);
  fillMarket(state);
  m.orderDeck = shuffle(state, createOrders());
  m.orders = m.orderDeck.splice(-3);
  log(
    state,
    'setup',
    `V7.1：${names.length} 人，${state.players[state.activePlayerIndex].name} 随机先手，顺时针；${m.ordersToWin} 单获胜。每人 2 食物、3 币。`,
    undefined,
    { v71: 'setup', ordersToWin: m.ordersToWin },
  );
  return state;
}
