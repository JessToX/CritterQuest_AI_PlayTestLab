import { isFood } from '../game/market.ts';
import type { PublicMarketState } from '../game/market-types.ts';
import type { FoodCard, LegalAction, Mission } from '../game/types.ts';

// A deterministic public-information heuristic for exercising the lab, not AI or balance evidence.
export function marketSimulationAction(
  actions: LegalAction[],
  market: PublicMarketState,
  selfId: string,
) {
  const self = market.players.find((p) => p.id === selfId)!;
  const gap = (cards: FoodCard[], order: Mission) =>
    Object.entries(order.requirements).reduce(
      (n, [food, count]) =>
        n + Math.max(0, count - cards.filter((c) => c.food === food).length),
      0,
    );
  const score = (cards: FoodCard[]) => {
    const gaps = market.orders.map((o) => gap(cards, o));
    return -Math.min(4, ...gaps) * 10 - gaps.reduce((a, b) => a + b, 0);
  };
  const ranked = actions.map((entry) => {
    const a = entry.action;
    let value = -100;
    if (a.type === 'submit_order') value = 1000;
    if (a.type === 'skip_order' || a.type === 'end_buy') value = 0;
    if (a.type === 'refresh_market') value = 1;
    if (a.type === 'discard' || a.type === 'rotten_discard')
      value = score(self.foods.filter((c) => c.id !== a.cardId));
    if (a.type === 'fresh_swap')
      value = score([
        ...self.foods.filter((c) => c.id !== a.foodId),
        market.market.find((c) => c.id === a.marketCardId)! as FoodCard,
      ]);
    if (a.type === 'buy' && market.purchasesThisTurn < 4) {
      const card = market.market.find((c) => c.id === a.cardId)!;
      if (a.recipientId === selfId) {
        if (isFood(card))
          value = score([...self.foods, card]) - score(self.foods) - 2;
        else if (card.event === 'coins')
          value =
            card.amount! >= 2 ? Math.min(card.amount!, market.bank + 2) : -10;
        else if (card.event === 'super') value = 2;
        else if (
          card.event === 'fresh' &&
          self.foods.length &&
          market.market.some(isFood)
        )
          value = 1;
      }
    }
    return { entry, value };
  });
  ranked.sort((a, b) => b.value - a.value);
  return ranked[0].entry;
}
