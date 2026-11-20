'use client';
import { EmptyState, GameStatus } from '@/components/lab/primitives';
import { ArrowRight, Pause, PawPrint, Square, Trophy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { TabsContent } from '@/components/ui/tabs';
import { CallProgress } from './call-progress';
import { MarketTable } from './market-table';
import { LiveScene } from './live-scene';
import { critterSeatIndex } from '@/components/lab/critter-portrait';
import {
  phaseNames,
  readableText,
  savedActionLabel,
  taskNames,
} from '@/lib/game/labels';
import { reportFor } from '@/lib/reports/report';
import type { GameRecord } from '@/lib/playtest/types';
import type { Dispatch, SetStateAction } from 'react';
import type { RepairSummaries, StartPlaytest } from '@/lib/playtest/commands';

interface Props {
  running: boolean;
  stopping: boolean;
  pauseRun: () => void;
  current: GameRecord | null;
  summarizing: boolean;
  setTerminateConfirm: Dispatch<SetStateAction<boolean>>;
  unsavedGame: GameRecord | null;
  retryUnsavedGame: () => Promise<void>;
  retryingSave: boolean;
  repairSummaries: RepairSummaries;
  start: StartPlaytest;
  panel: string;
  setTab: Dispatch<SetStateAction<string>>;
}
export function LivePanel({
  running,
  stopping,
  pauseRun,
  current,
  summarizing,
  setTerminateConfirm,
  unsavedGame,
  retryUnsavedGame,
  retryingSave,
  repairSummaries,
  start,
  panel,
  setTab,
}: Props) {
  const report = current ? reportFor(current) : null;
  const acting =
    current?.state.status === 'active'
      ? current.state.players.find(
          (player) => player.id === current.state.decisionPlayerId,
        )
      : undefined;
  return (
    <TabsContent value="live" className="space-y-3">
      {(current || unsavedGame) && (
        <div className="cq-live-controls">
          {current && (
            <div className="cq-live-status">
              <GameStatus status={current.status} />
              <strong>
                第 {current.state.turn} 回合 ·{' '}
                {current.state.status !== 'active'
                  ? '已结束'
                  : (phaseNames[current.state.phase] ?? '回合进行中')}
              </strong>
              {current.state.winnerId && report ? (
                <span className="cq-live-winner">
                  <Trophy size={14} aria-hidden="true" />
                  {report.winner} 获胜
                </span>
              ) : (
                <span>
                  {acting ? `${acting.name} 行动` : current.rule.label}
                </span>
              )}
            </div>
          )}
          <div className="cq-live-actions">
            {(running || current?.status === 'running') && (
              <Button disabled={!running || stopping} onClick={pauseRun}>
                <Pause size={14} aria-hidden="true" />
                {summarizing ? '取消总结' : '暂停并保存'}
              </Button>
            )}
            {current?.status === 'paused' && (
              <Button
                disabled={running}
                onClick={() => void start(current.mode, current)}
              >
                继续当前对局
              </Button>
            )}
            <Button
              variant="outline"
              disabled={
                stopping ||
                !current ||
                current.status === 'complete' ||
                current.status === 'terminated'
              }
              onClick={() => setTerminateConfirm(true)}
            >
              <Square size={13} aria-hidden="true" />
              {stopping ? '正在终止并保存…' : '终止对局'}
            </Button>
            {unsavedGame && (
              <Button
                disabled={retryingSave}
                focusableWhenDisabled
                onClick={() => void retryUnsavedGame()}
              >
                {retryingSave ? '正在重试保存…' : '重试保存'}
              </Button>
            )}
            {current &&
              !running &&
              (current.status === 'complete' ||
                current.status === 'terminated') && (
                <Button onClick={() => void repairSummaries(current)}>
                  补生成未完成总结
                </Button>
              )}
            {current?.status === 'terminated' && (
              <p>对局已终止，不能继续。{current.terminationReason}</p>
            )}
          </div>
          {current && (current.inFlight || current.retryWait) && (
            <CallProgress game={current} />
          )}
        </div>
      )}
      {current ? (
        <>
          <LiveScene
            game={current}
            running={running}
            stopping={stopping}
            summarizing={summarizing}
            unsaved={!!unsavedGame}
          />
          <div className="cq-live-composition">
            <section className={`${panel} cq-live-table`}>
              <MarketTable
                state={current.state}
                portraitIndices={current.seats.map((seat, i) =>
                  critterSeatIndex(seat.id, i),
                )}
              />
              <p className="text-xs text-muted-foreground mt-5">
                设计者全知视角。每个 AI 只收到其座位可见的信息。
              </p>
            </section>
            <aside
              className={`${panel} cq-public-streams`}
              aria-label="动作与桌聊"
            >
              <section>
                <h2 className="font-bold mb-3">动作与桌聊</h2>
                <div className="max-h-96 overflow-auto space-y-2 text-sm">
                  {current.state.events.slice(-80).map((e) => (
                    <p key={e.id}>
                      T{e.turn} · {readableText(e.publicText)}
                    </p>
                  ))}
                </div>
              </section>
              <section id="public-table-talk" tabIndex={-1}>
                <h2 className="font-bold mb-3">公开桌聊</h2>
                <p className="text-sm text-slate-400 mb-3">
                  AI 自行决定发言或保持沉默。沉默不会作为消息发送给其他 AI。
                </p>
                <div className="max-h-96 overflow-auto space-y-3">
                  {!current.chat.length && (
                    <p className="text-sm">暂无公开发言。</p>
                  )}
                  {current.chat.slice(-50).map((c, i) => (
                    <p key={i} className="text-sm">
                      <span className="cq-chat-name">
                        T{c.turn} {c.speaker}：
                      </span>
                      {c.message}
                    </p>
                  ))}
                </div>
                {!!current.chatChoices?.length && (
                  <details className="mt-3">
                    <summary>发言选择记录</summary>
                    {current.chatChoices.slice(-50).map((c, i) => (
                      <p key={i} className="text-sm">
                        T{c.turn} · {c.speaker}：
                        {c.failed
                          ? '本次发言未取得：' + c.error
                          : c.spoke
                            ? '选择发言'
                            : '选择不回复'}
                      </p>
                    ))}
                  </details>
                )}
              </section>
              <Button variant="outline" onClick={() => setTab('reports')}>
                查看测试报告
              </Button>
            </aside>
          </div>
          <details className={panel}>
            <summary>对局信息与调用统计</summary>
            <div className="cq-session-stats">
              <span>
                <strong>{current.state.round}</strong> 当前轮次
              </span>
              <span>
                <strong>{report!.completedRounds}</strong> 完整轮次
              </span>
              <span>
                <strong>{current.calls.length}</strong> 模型调用
              </span>
              <span>
                <strong>{current.state.players.length}</strong> 位参与者
              </span>
            </div>

            <p className="text-xs text-muted-foreground">
              种子 {current.state.seed} · 公共订单 2+1+1 · 先手{' '}
              {current.state.players.find(
                (p) => p.id === current.initialFirstPlayerId,
              )?.name || '未记录'}{' '}
              · 回合方向{' '}
              {(current.state.turnDirection ?? 1) === 1 ? '顺时针' : '逆时针'}
            </p>
            <p className="text-xs text-muted-foreground mt-2">
              已知输入 Token {report!.inputTokens} · 用量未知{' '}
              {report!.unknownUsageCalls} 次 ·{' '}
              {current.status === 'complete' || current.status === 'terminated'
                ? '牌局已结束'
                : `下次阶段总结：第 ${(Math.floor(report!.completedRounds / 10) + 1) * 10} 轮结束`}
            </p>
          </details>
          <div className="cq-live-streams">
            <section className={panel}>
              <h2 className="font-semibold text-base">AI 行动与决策理由</h2>
              <p className="text-sm text-slate-400 my-2">
                AI 提供的简短决策说明，仅供设计者查看，不会作为桌聊发送给其他
                AI。
              </p>
              <div className="max-h-96 overflow-auto space-y-3">
                {current.decisions?.length ? (
                  current.decisions
                    .slice()
                    .reverse()
                    .map((d) => (
                      <article key={d.id} className="cq-stream-item">
                        <p className="font-bold">
                          T{d.turn} · {d.name} · {d.model}
                        </p>
                        <p>
                          行动：{savedActionLabel(d.label, d.action)} ·{' '}
                          {d.status === 'executed'
                            ? '已执行'
                            : current.status === 'terminated'
                              ? '已终止，未执行'
                              : '已选择，待执行'}
                        </p>
                        <p className="whitespace-pre-wrap mt-1">
                          理由：{d.reason || '模型未提供决策说明'}
                        </p>
                      </article>
                    ))
                ) : (
                  <p>
                    尚无决策说明。旧对局未保存独立说明，新对局会在 AI
                    选定行动后显示。
                  </p>
                )}
              </div>
            </section>
            <section className={panel}>
              <h2 className="font-bold">各 AI 阶段记忆与总结</h2>
              {!current.summaryJobs?.length && (
                <p className="text-sm mt-2">
                  尚未到总结时间：每 10 个完整轮次及对局结束时生成。
                </p>
              )}
              <div className="max-h-96 overflow-auto">
                {current.summaryJobs?.map((j) => (
                  <article key={j.id} className="my-3 rounded cq-subtle p-3">
                    <p>
                      {
                        current.state.players.find((p) => p.id === j.playerId)
                          ?.name
                      }{' '}
                      ·{' '}
                      {j.kind === 'checkpoint'
                        ? `第 ${j.round} 轮阶段总结`
                        : '单局收尾反思'}{' '}
                      ·{' '}
                      {
                        {
                          pending: '等待生成',
                          complete: '已生成',
                          failed: '失败',
                          cancelled: '已取消',
                        }[j.status]
                      }
                    </p>
                    <p className="whitespace-pre-wrap text-sm mt-2">
                      {j.content || j.error || '正在准备总结'}
                    </p>
                    {j.status !== 'complete' && !running && (
                      <Button
                        size="sm"
                        onClick={() =>
                          void repairSummaries(current, {
                            kind: j.kind,
                            round: j.round,
                            playerId: j.playerId,
                          })
                        }
                      >
                        补生成此总结
                      </Button>
                    )}
                  </article>
                ))}
              </div>
            </section>
          </div>
          <details className={panel}>
            <summary>逐次调用与错误记录</summary>
            {current.calls
              .slice()
              .reverse()
              .map((c, i) => (
                <p className="text-sm my-2" key={i}>
                  T{c.turn} ·{' '}
                  {current.seats.find((s) => s.id === c.seatId)?.name} ·{' '}
                  {c.model ||
                    current.seats.find((s) => s.id === c.seatId)?.model}{' '}
                  · {taskNames[c.task] || c.task} ·{' '}
                  {(c.latencyMs / 1000).toFixed(1)} 秒 · {c.error || '成功'}{' '}
                  {c.requestId ? `· 请求 ${c.requestId}` : ''}
                </p>
              ))}
          </details>
        </>
      ) : (
        <EmptyState
          icon={PawPrint}
          title={running ? '正在准备对局' : '这张牌桌，正在等你入座'}
          description={
            running
              ? '对局开始后，市场、订单和决策会显示在这里。'
              : '先配置 AI 搭档，或运行一次免费模拟。对局开始后，市场、订单和每一步决策都会显示在这里。'
          }
        >
          <Button onClick={() => setTab('table')}>
            前往牌桌 <ArrowRight size={15} aria-hidden="true" />
          </Button>
          <Button variant="outline" onClick={() => setTab('reports')}>
            查看历史报告
          </Button>
        </EmptyState>
      )}
    </TabsContent>
  );
}
