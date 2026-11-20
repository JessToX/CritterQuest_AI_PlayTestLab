import { marketState } from '../game/market-types.ts';
import { failureDetails } from '../agents/diagnostics.ts';
import { taskNames } from '../game/labels.ts';
import type { GameRecord } from '../playtest/types.ts';
export function analytics(games: GameRecord[]) {
  const groups = new Map<
    string,
    {
      label: string;
      seats: number;
      wins: number;
      ended: number;
      unfinished: number;
      rounds: number[];
    }
  >();
  const models = new Map<
    string,
    {
      label: string;
      calls: number;
      timeouts: number;
      cancelled: number;
      errors: number;
      latencies: number[];
      inputTokens: number;
      outputTokens: number;
      unknown: number;
    }
  >();
  for (const g of games) {
    g.state.players.forEach((p, i) => {
      const seat = g.seats[i];
      const market = marketState(g.state);
      const label = `${g.mode === 'api' ? '真实 API' : '模拟'} · ${g.rule.label} · ${g.state.players.length}人 · 公共订单 ${market.ordersToWin} 单获胜 / ${g.state.config.foodLimit ? `上限 ${g.state.config.foodLimit}` : '无上限对照'} · ${seat.model} · ${({ active: '学习', frozen: '冻结', disabled: '关闭' } as Record<string, string>)[seat.memoryMode] || seat.memoryMode} · 随机先手，顺时针`;
      const key = JSON.stringify([
        g.mode,
        g.rule.id,
        g.state.players.length,
        seat.model,
        seat.provider,
        seat.connectionFingerprint,
        seat.modelSettings,
        seat.memoryMode,
        g.experiment?.missionMode,
        g.runtime?.chat,
        market.ordersToWin,
        g.state.config.foodLimit,
        g.state.config.maxRounds,
      ]);
      const row = groups.get(key) || {
        label,
        seats: 0,
        wins: 0,
        ended: 0,
        unfinished: 0,
        rounds: [],
      };
      row.seats++;
      if (g.status === 'complete') {
        row.ended++;
        if (g.state.winnerId === p.id) {
          row.wins++;
          row.rounds.push(g.state.round);
        }
      } else row.unfinished++;
      groups.set(key, row);
    });
    for (const c of g.calls) {
      const seat = g.seats.find((s) => s.id === c.seatId),
        label = `${g.mode === 'api' ? '真实 API' : '模拟'} · ${seat?.name || c.seatId} · ${c.model || seat?.model || '未知'} · ${taskNames[c.task] || c.task}`;
      const key = JSON.stringify([
        g.mode,
        c.seatId,
        c.model || seat?.model,
        seat?.connectionFingerprint,
        seat?.modelSettings,
        c.task,
      ]);
      const row = models.get(key) || {
        label,
        calls: 0,
        timeouts: 0,
        cancelled: 0,
        errors: 0,
        latencies: [],
        inputTokens: 0,
        outputTokens: 0,
        unknown: 0,
      };
      row.calls++;
      row.latencies.push(c.latencyMs);
      row.inputTokens += c.inputTokens;
      row.outputTokens += c.outputTokens;
      const code =
        c.details?.code ||
        (c.error ? failureDetails(new Error(c.error)).code : undefined);
      if (
        code === 'timeout' ||
        c.details?.status === 504 ||
        /HTTP 504/.test(c.error || '')
      )
        row.timeouts++;
      if (code === 'cancelled') row.cancelled++;
      if (c.error && code !== 'cancelled') row.errors++;
      if (c.usageKnown === false || (c.usageKnown === undefined && !!c.error))
        row.unknown++;
      models.set(key, row);
    }
  }
  return {
    groups: [...groups.values()].map((r) => ({
      ...r,
      winRate: r.ended ? r.wins / r.ended : null,
      meanWinningRounds: r.rounds.length
        ? r.rounds.reduce((a, b) => a + b, 0) / r.rounds.length
        : null,
    })),
    models: [...models.values()].map((r) => ({
      ...r,
      p50: percentile(r.latencies, 0.5),
      p95: percentile(r.latencies, 0.95),
    })),
  };
}
function percentile(values: number[], q: number) {
  const v = [...values].sort((a, b) => a - b);
  return v.length ? v[Math.max(0, Math.ceil(v.length * q) - 1)] : 0;
}
