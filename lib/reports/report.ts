import { marketState } from '../game/market-types.ts';
import type { GameRecord } from '../playtest/types.ts';
import { v71Stats } from './v71-stats.ts';
export function reportFor(r: GameRecord) {
  const market = marketState(r.state);
  const events = r.state.events;
  return {
    id: r.id,
    ruleVersion: r.rule.id,
    seed: r.state.seed,
    engineVersion: r.engineVersion,
    gameMode: market.ordersToWin === 2 ? 'quick' : 'standard',
    ordersToWin: market.ordersToWin,
    foodLimit: r.state.config.foodLimit,
    bankCoins: market.bank,
    firstPlayerWon: r.state.winnerId
      ? r.state.winnerId === r.initialFirstPlayerId
      : null,
    terminationReason:
      r.terminationReason ??
      (r.state.status === 'draw' ? 'test_round_limit' : (r.error ?? null)),
    playerCount: r.state.players.length,
    pattern: r.state.missionPattern ?? null,
    firstPlayerId: r.initialFirstPlayerId ?? null,
    experimentMode: 'standard',
    mode: r.mode,
    status: r.status,
    title: r.title,
    notes: r.notes,
    rounds: r.state.round,
    turns: r.state.turn,
    winner:
      r.status === 'complete'
        ? r.state.players.find((p) => p.id === r.state.winnerId)?.name ||
          '无胜者'
        : '未完成',
    players: r.state.players.map((p, i) => ({
      name: p.name,
      model: r.seats[i].model,
      coins: market.accounts[p.id].coins,
      completedOrders: market.accounts[p.id].completedOrders,
      foods: p.questRow,
      won: p.id === r.state.winnerId,
    })),
    v71: v71Stats(events),
    calls: r.calls.length,
    errors: r.calls.filter((c) => c.error && c.details?.code !== 'cancelled')
      .length,
    cancellations: r.calls.filter((c) => c.details?.code === 'cancelled')
      .length,
    unknownUsageCalls: r.calls.filter(
      (c) =>
        c.usageKnown === false || (c.usageKnown === undefined && !!c.error),
    ).length,
    completedRounds:
      r.state.status === 'active'
        ? Math.floor((r.state.turn - 1) / r.state.players.length)
        : Math.floor(r.state.turn / r.state.players.length),
    inputTokens: r.calls.reduce((n, c) => n + c.inputTokens, 0),
    outputTokens: r.calls.reduce((n, c) => n + c.outputTokens, 0),
    averageLatencyMs: r.calls.length
      ? Math.round(
          r.calls.reduce((n, c) => n + c.latencyMs, 0) / r.calls.length,
        )
      : 0,
  };
}
