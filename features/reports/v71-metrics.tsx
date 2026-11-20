import type { GameRecord } from '@/lib/playtest/types';
import { reportFor } from '@/lib/reports/report';
import { v71Summary } from '@/lib/reports/v71-stats';

export function V71Metrics({ game }: { game: GameRecord }) {
  const report = reportFor(game),
    stats = report.v71;
  if (!stats) return null;
  return (
    <section className="mt-4 space-y-2 text-sm">
      <h3 className="font-bold">
        V7.1 试玩指标 · {report.ordersToWin} 单获胜 ·{' '}
        {report.foodLimit ? `上限 ${report.foodLimit} 张` : '无上限对照'}
      </h3>
      {v71Summary(stats).map((text) => (
        <p key={text}>{text}</p>
      ))}
      <div className="overflow-x-auto">
        <table className="w-full text-left mt-3">
          <thead>
            <tr>
              {[
                '玩家',
                '回合',
                '购买食物 / 事件',
                '最多连续购买',
                '无购买交单回合',
                '交单时点',
              ].map((label) => (
                <th key={label} className="p-2 border-b border-border">
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {stats.players.map((p) => (
              <tr key={p.playerId}>
                <td className="p-2">
                  {
                    game.state.players.find(
                      (player) => player.id === p.playerId,
                    )?.name
                  }
                </td>
                <td className="p-2">{p.turns}</td>
                <td className="p-2">
                  {p.foodPurchases} / {p.eventPurchases}
                </td>
                <td className="p-2">{p.maxPurchasesInTurn}</td>
                <td className="p-2">{p.turnsWithoutBuyOrOrder}</td>
                <td className="p-2">
                  {p.completedOrders
                    .map(
                      (order) =>
                        `${order.orderId}：本人第 ${order.personalTurn} 回合${order.window === 'order_before' ? '抽前' : '抽后'}`,
                    )
                    .join('；') || '无'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
