'use client';
import type { GameRecord } from '../../lib/playtest/types.ts';
import { analytics } from '../../lib/reports/analytics.ts';
export function LabAnalytics({ games }: { games: GameRecord[] }) {
  const data = analytics(games);
  if (!games.length)
    return (
      <details>
        <summary>实验结果与模型稳定性统计</summary>
        <p className="text-xs text-muted-foreground">
          保存对局后，这里将展示按实验条件区分的结果和调用统计。
        </p>
      </details>
    );
  return (
    <details className="cq-panel">
      <summary className="cursor-pointer font-bold">
        V7.1 实验结果与模型稳定性统计
      </summary>
      <p className="my-3 text-sm text-slate-400">
        按规则、人数、获胜目标、食物上限、模型、记忆与实验条件分别统计。
        胜率只使用完成局；平均完成轮数只计获胜者。小样本仅供观察，不自动生成排名。
      </p>
      <div className="overflow-auto">
        <table className="w-full text-sm">
          <thead>
            <tr>
              {['实验条件', '完成 / 未完成', '胜率', '获胜平均轮数'].map(
                (h) => (
                  <th className="p-2 text-left" key={h}>
                    {h}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {data.groups.map((r, i) => (
              <tr key={i}>
                <td className="p-2">{r.label}</td>
                <td>
                  {r.ended} / {r.unfinished}
                </td>
                <td>
                  {r.winRate === null
                    ? '—'
                    : (r.winRate * 100).toFixed(1) + '%'}
                </td>
                <td>{r.meanWinningRounds?.toFixed(1) || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="overflow-auto mt-5">
        <table className="w-full text-sm">
          <thead>
            <tr>
              {[
                '模型 / 任务',
                '调用',
                '超时 / 取消 / 错误',
                'P50 / P95 秒',
                '已知输入 / 输出 Token',
                '用量未知调用',
              ].map((h) => (
                <th className="p-2 text-left" key={h}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.models.map((r, i) => (
              <tr key={i}>
                <td className="p-2">{r.label}</td>
                <td>{r.calls}</td>
                <td>
                  {r.timeouts} / {r.cancelled} / {r.errors}
                </td>
                <td>
                  {(r.p50 / 1000).toFixed(1)} / {(r.p95 / 1000).toFixed(1)}
                </td>
                <td>
                  {r.inputTokens} / {r.outputTokens}
                </td>
                <td>{r.unknown}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}
