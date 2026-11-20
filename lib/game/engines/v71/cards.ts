// License scope: V71_CONFIG, deck and order content are mapped in LICENSE-SCOPE.md.
import { log } from '../../events.ts';
import { shuffle } from '../../random.ts';
import { MARKET_FOODS as foods } from '../../market.ts';
import { marketState } from '../../market-types.ts';
import type { MarketCard } from '../../market-types.ts';
import type { GameState, Mission, RuleConfig } from '../../types.ts';

export const V71_CONFIG: RuleConfig = {
  mechanics: 'v7.1',
  // Normal copies per food. Super/Rotten are standalone events in this version.
  copies: { normal: 12, super: 0, rotten: 0 },
  foodLimit: 6,
  maxRounds: 100,
  patterns: ['2+1+1'],
  ordersToWin: 3,
};

export function createOrders(): Mission[] {
  const combinations = [
    [2, 1, 1, 0],
    [2, 1, 0, 1],
    [2, 0, 1, 1],
    [1, 2, 1, 0],
    [1, 2, 0, 1],
    [0, 2, 1, 1],
    [1, 1, 2, 0],
    [1, 0, 2, 1],
    [0, 1, 2, 1],
    [1, 1, 0, 2],
    [1, 0, 1, 2],
    [0, 1, 1, 2],
  ];
  return combinations.map((counts, i) => ({
    id: `Q${String(i + 1).padStart(2, '0')}`,
    pattern: '2+1+1',
    requirements: Object.fromEntries(
      foods.map((food, j) => [food, counts[j]]),
    ) as Mission['requirements'],
  }));
}
export function createMainCards(): MarketCard[] {
  const cards: MarketCard[] = foods.flatMap((food) =>
    Array.from({ length: 12 }, (_, i) => ({
      id: `${food}-normal-${i + 1}`,
      food,
      variant: 'normal' as const,
    })),
  );
  for (const event of ['super', 'rotten', 'fresh'] as const)
    for (let i = 1; i <= 4; i++) cards.push({ id: `${event}-${i}`, event });
  for (const [amount, count] of [
    [3, 4],
    [2, 5],
    [1, 6],
    [-1, 2],
    [-2, 1],
    [-3, 1],
  ])
    for (let i = 1; i <= count; i++)
      cards.push({ id: `coins-${amount}-${i}`, event: 'coins', amount });
  return cards;
}

export function drawCard(state: GameState): MarketCard | undefined {
  const m = marketState(state);
  if (!m.deck.length && m.discard.length) {
    m.deck = shuffle(state, m.discard);
    m.discard = [];
    log(state, 'effect', '主牌弃牌堆重洗', undefined, { v71: 'reshuffle' });
  }
  return m.deck.pop();
}
export function fillMarket(state: GameState) {
  const m = marketState(state);
  while (m.market.length < 5) {
    const card = drawCard(state);
    if (!card) break;
    m.market.push(card);
  }
}
