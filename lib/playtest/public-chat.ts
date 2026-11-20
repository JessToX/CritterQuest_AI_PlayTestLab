import { validatePublicChatInput } from '../agents/public-output.ts';
import { foodLabel } from '../game/labels.ts';
import { publicMarket, marketCardLabel } from '../game/market.ts';
import type { GameRecord } from './types.ts';

// Construct from domain-owned public fields, never by redacting a player view.
// Do not spread state/player/event/account objects here: they contain secrets.
export function publicChatInput(r: GameRecord, index: number) {
  const s = r.state;
  const market = s.config.mechanics === 'v7.1' ? publicMarket(s) : undefined;
  const table = {
    turn: s.turn,
    round: s.round,
    phase: s.phase,
    activePlayer: s.players[s.activePlayerIndex].name,
    players: s.players.map((p) => ({
      name: p.name,
      character: p.character,
      foods: p.questRow.map(foodLabel),
      handCount: p.hand.length,
      ...(market
        ? {
            coins: market.players.find((x) => x.id === p.id)?.coins,
            completedOrders: market.players.find((x) => x.id === p.id)
              ?.completedOrders.length,
          }
        : {}),
    })),
    ...(market
      ? {
          market: market.market.map(marketCardLabel),
          orders: market.orders.map((o) => ({
            pattern: o.pattern,
            requirements: {
              seed: o.requirements.seed,
              fish: o.requirements.fish,
              bone: o.requirements.bone,
              cheese: o.requirements.cheese,
            },
          })),
          bank: market.bank,
          ordersToWin: market.ordersToWin,
        }
      : {}),
    events: s.events
      .filter((e) => e.type !== 'chat')
      .slice(-12)
      .map((e) => ({ turn: e.turn, type: e.type, text: e.publicText })),
  };
  return validatePublicChatInput({
    channel: 'public-table-v1',
    speaker: s.players[index].name,
    rulebook: r.rule.text,
    tableText: JSON.stringify(table),
    publicChat: r.chat
      .filter((c) => c.channel === 'public-table-v1')
      .slice(-12)
      .map((c) => ({
        speaker: c.speaker,
        message: c.message,
        turn: c.turn,
      })),
  });
}
