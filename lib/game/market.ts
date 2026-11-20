// License scope: V7.1 card data and market helpers are mapped in LICENSE-SCOPE.md.
// Public, read-only V7.1 helpers shared by the UI, AI context and engine.
import { foodLabel } from './labels.ts';
import { marketState } from './market-types.ts';
import type { MarketCard, PublicMarketState } from './market-types.ts';
import type {
  FoodCard,
  FoodKind,
  GameState,
  Mission,
  VisibleGameState,
} from './types.ts';

export const MARKET_FOODS: FoodKind[] = ['seed', 'fish', 'bone', 'cheese'];
export const isFood = (card: MarketCard): card is FoodCard => 'food' in card;
export const marketCardLabel = (card: MarketCard) =>
  isFood(card)
    ? foodLabel(card)
    : card.event === 'coins'
      ? `${card.amount! > 0 ? '+' : ''}${card.amount} 币`
      : {
          super: 'Super 追加抽牌',
          rotten: 'Rotten 弃掉食物',
          fresh: 'Fresh 交换食物',
        }[card.event];
export const marketPrice = (card: MarketCard) => (isFood(card) ? 3 : 2);

export const canSubmit = (owned: FoodCard[], order: Mission) =>
  MARKET_FOODS.every(
    (food) =>
      owned.filter((c) => c.food === food).length >= order.requirements[food],
  );

export function publicMarket(state: GameState): PublicMarketState {
  const m = marketState(state);
  return structuredClone({
    purchasesThisTurn: state.events.filter(
      (e) => e.turn === state.turn && e.payload?.v71 === 'purchase',
    ).length,
    market: m.market,
    orders: m.orders,
    bank: m.bank,
    orderDeckCount: m.orderDeck.length,
    ordersToWin: m.ordersToWin,
    submittedThisTurn: m.submittedThisTurn,
    refreshAvailable: m.refreshAvailable,
    resolving: m.pending[0]?.kind ?? null,
    players: state.players.map((p) => ({
      id: p.id,
      name: p.name,
      foods: p.questRow,
      ...m.accounts[p.id],
    })),
  });
}

// AI context has only the public V7.1 vocabulary; no legacy role/mission fields.
export function marketDecisionView(view: VisibleGameState) {
  if (!view.marketGame) return view;
  const { self, opponents: _opponents, ...common } = view;
  return {
    ...common,
    self: view.marketGame.players.find((p) => p.id === self.id)!,
    opponents: view.marketGame.players.filter((p) => p.id !== self.id),
  };
}
