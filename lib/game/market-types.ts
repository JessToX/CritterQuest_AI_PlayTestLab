import type { FoodCard, GameState, Mission } from './types.ts';

export type EventCard = {
  id: string;
  event: 'super' | 'rotten' | 'fresh' | 'coins';
  amount?: number;
};
export type MarketCard = FoodCard | EventCard;
export type MarketAction =
  | { type: 'buy'; cardId: string; recipientId: string }
  | { type: 'refresh_market'; cardId: string }
  | { type: 'end_buy' }
  | { type: 'submit_order'; orderId: string }
  | { type: 'skip_order' }
  | { type: 'rotten_discard'; cardId: string }
  | { type: 'fresh_swap'; foodId: string; marketCardId: string };

export type MarketStep =
  | { kind: 'acquire'; recipientId: string; card: MarketCard }
  | { kind: 'draw'; recipientId: string; source: 'normal' | 'super' }
  | { kind: 'discard_event'; card: EventCard }
  | { kind: 'rotten_choice'; recipientId: string; card: EventCard }
  | { kind: 'fresh_choice'; recipientId: string; card: EventCard };

export interface MarketState {
  deck: MarketCard[];
  discard: MarketCard[];
  market: MarketCard[];
  orderDeck: Mission[];
  orders: Mission[];
  accounts: Record<string, { coins: number; completedOrders: Mission[] }>;
  bank: number;
  ordersToWin: 2 | 3;
  submittedThisTurn: boolean;
  refreshAvailable: boolean;
  resumePhase: 'buy' | 'order_after';
  pending: MarketStep[];
}

export interface PublicMarketState {
  purchasesThisTurn: number;
  market: MarketCard[];
  orders: Mission[];
  orderDeckCount: number;
  bank: number;
  ordersToWin: 2 | 3;
  submittedThisTurn: boolean;
  refreshAvailable: boolean;
  resolving: string | null;
  players: Array<{
    id: string;
    name: string;
    foods: FoodCard[];
    coins: number;
    completedOrders: Mission[];
  }>;
}

export function marketState(state: GameState): MarketState {
  if (state.config.mechanics !== 'v7.1' || !state.marketGame)
    throw new Error('缺少 V7.1 市场状态');
  return state.marketGame;
}
