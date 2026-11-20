import { publicMarket } from '../../market.ts';
import { marketState } from '../../market-types.ts';
import type { GameState, VisibleGameState } from '../../types.ts';
import { activePlayer } from './flow.ts';

export function visibleStateFor(
  state: GameState,
  playerId: string,
): VisibleGameState {
  const p = state.players.find((p) => p.id === playerId);
  if (!p) throw new Error('找不到玩家');
  const m = marketState(state);
  return structuredClone({
    gameId: state.id,
    ruleVersion: state.ruleVersion,
    round: state.round,
    turn: state.turn,
    activePlayerId: activePlayer(state).id,
    self: p,
    opponents: state.players
      .filter((p) => p.id !== playerId)
      .map(({ hand: _hand, mission: _mission, ...other }) => ({
        ...other,
        handCount: 0,
      })),
    deckCount: m.deck.length,
    discardCount: m.discard.length,
    recentEvents: state.events
      .slice(-30)
      .map(({ id, turn, round, actorId, type, publicText }) => ({
        id,
        turn,
        round,
        actorId,
        type,
        publicText,
      })),
    phase: state.phase,
    decisionPlayerId: state.decisionPlayerId ?? activePlayer(state).id,
    marketGame: publicMarket(state),
  });
}
