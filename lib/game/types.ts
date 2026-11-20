import type {
  MarketAction,
  MarketState,
  PublicMarketState,
} from './market-types.ts';
export type FoodKind = 'fish' | 'bone' | 'cheese' | 'seed';
export type FoodVariant = 'normal' | 'super' | 'rotten';
export type CharacterKind = 'bird' | 'cat' | 'dog' | 'mouse';

export interface FoodCard {
  id: string;
  food: FoodKind;
  variant: FoodVariant;
  guardedUntilTurn?: number;
  guardedByPlayerId?: string;
  cursed?: boolean;
  cursedByPlayerId?: string;
  curseExcludedWinTurn?: number;
  frozenByCharacter?: CharacterKind;
}

export interface Mission {
  id: string;
  requirements: Record<FoodKind, number>;
  pattern: '1+1+1+1' | '2+1+1' | '2+2' | '3+1' | '4';
}

export interface PlayerState {
  id: string;
  name: string;
  character: CharacterKind | null;
  mission: Mission | null;
  hand: FoodCard[];
  questRow: FoodCard[];
  abilityReady: boolean;
  cooldown?: number;
  frozen: boolean;
  cooldownUsedTurn?: number;
  knownMissions?: Record<string, Mission>;
}

export interface RuleConfig {
  mechanics?: 'v7.1';
  copies: { normal: number; super: number; rotten: number };
  foodLimit: number;
  maxRounds: number;
  patterns: Mission['pattern'][];
  ordersToWin?: 2 | 3;
}

export interface GameState {
  marketGame?: MarketState;
  id: string;
  ruleVersion: string;
  seed: number;
  rngState: number;
  initialDeckOrder?: string[];
  round: number;
  turn: number;
  activePlayerIndex: number;
  turnDirection?: 1 | -1;
  deck: FoodCard[];
  discard: FoodCard[];
  players: PlayerState[];
  winnerId?: string;
  status: 'active' | 'complete' | 'draw';
  events: GameEvent[];
  config: RuleConfig;
  missionPattern?: Mission['pattern'];
  phase:
    | 'start'
    | 'resolve'
    | 'cleanup'
    | 'buy'
    | 'order_before'
    | 'order_after';
  pending: never[];
  choices: Record<string, string>;
  rottenTriggered: boolean;
  decisionPlayerId?: string;
}

export type GameAction = MarketAction | { type: 'discard'; cardId: string };

export interface LegalAction {
  id: string;
  label: string;
  action: GameAction;
}

export interface GameEvent {
  id: string;
  turn: number;
  round: number;
  actorId?: string;
  type:
    | 'setup'
    | 'draw'
    | 'place'
    | 'action'
    | 'effect'
    | 'cleanup'
    | 'cooldown'
    | 'win'
    | 'draw_game'
    | 'chat';
  publicText: string;
  privateTextByPlayer?: Record<string, string>;
  payload?: Record<string, unknown>;
}

export interface VisibleGameState {
  marketGame?: PublicMarketState;
  gameId: string;
  missionPattern?: Mission['pattern'];
  ruleVersion: string;
  round: number;
  turn: number;
  activePlayerId: string;
  self: PlayerState;
  opponents: Array<
    Omit<PlayerState, 'hand' | 'mission'> & {
      handCount: number;
      missionPattern?: never;
    }
  >;
  deckCount: number;
  discardCount: number;
  discard?: FoodCard[];
  recentEvents: GameEvent[];
  phase: GameState['phase'];
  decisionPlayerId: string;
}
