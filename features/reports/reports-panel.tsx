'use client';
import {
  EmptyState,
  GameStatus,
  MetricCard,
  formatDate,
} from '@/components/lab/primitives';
import {
  ChartNoAxesCombined,
  CheckCheck,
  Clock3,
  Download,
  FlaskConical,
  Radio,
  Trophy,
  Users,
} from 'lucide-react';
import type { Dispatch, SetStateAction } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  NativeSelect,
  NativeSelectOption,
} from '@/components/ui/native-select';
import { TabsContent } from '@/components/ui/tabs';
import { LabAnalytics } from '@/features/reports/lab-analytics';
import { ReportActions, WordExport } from '@/features/reports/report-actions';
import { download } from '@/lib/client/download';
import { V71Metrics } from './v71-metrics';
import { reportFor } from '@/lib/reports/report';
import type { MemoryEntry } from '@/lib/memory/types';
import type { GameRecord } from '@/lib/playtest/types';
import type { RepairSummaries, StartPlaytest } from '@/lib/playtest/commands';
import { useReportManagement } from './use-report-management';
import { ReportBulkActions } from './report-bulk-actions';
import { useState } from 'react';
interface Props {
  panel: string;
  completed: GameRecord[];
  games: GameRecord[];
  ruleId: string;
  running: boolean;
  selectGame: (game: GameRecord) => void;
  stopping: boolean;
  replaceGame: (game: GameRecord) => void;
  removeGameFromState: (game: GameRecord) => void;
  memories: MemoryEntry[];
  repairSummaries: RepairSummaries;
  start: StartPlaytest;
  setTab: Dispatch<SetStateAction<string>>;
}
export function ReportsPanel({
  panel,
  completed,
  games,
  ruleId,
  running,
  selectGame,
  stopping,
  replaceGame,
  removeGameFromState,
  memories,
  repairSummaries,
  start,
  setTab,
}: Props) {
  const [scope, setScope] = useState('all');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectionRuleId, setSelectionRuleId] = useState(ruleId);
  if (selectionRuleId !== ruleId) {
    setSelectionRuleId(ruleId);
    setSelectedIds([]);
  }
  const currentGames = games.filter((g) => g.rule.id === ruleId);
  const visible = scope === 'all' ? games : currentGames;
  const selected = visible.filter(
    (g) => g.status !== 'running' && selectedIds.includes(g.id),
  );
  const { saveReport, deleteReport, deleteReports, deleting } =
    useReportManagement({ games, memories, replaceGame, removeGameFromState });
  return (
    <TabsContent value="reports" className="space-y-3">
      <section className={`cq-report-toolbar`} aria-label="报告批量操作">
        <div className="cq-list-toolbar">
          <h2 className="font-semibold">
            {scope === 'all' ? '全部报告' : '当前版本报告'}
            <span className="cq-badge ml-2">{visible.length}</span>
          </h2>
          <NativeSelect
            aria-label="报告范围"
            value={scope}
            disabled={deleting}
            onChange={(e) => {
              setScope(e.target.value);
              setSelectedIds([]);
            }}
          >
            <NativeSelectOption value="all">所有规则版本</NativeSelectOption>
            <NativeSelectOption value="current">
              仅当前规则版本
            </NativeSelectOption>
          </NativeSelect>
        </div>
        <div className="cq-export-row">
          <Button
            variant="outline"
            disabled={!completed.length}
            onClick={() =>
              download(
                'critter-quest-reports.json',
                completed.map((g) => ({
                  ...reportFor(g),
                  reflections: g.reflections,
                })),
              )
            }
          >
            <Download size={14} aria-hidden="true" />
            导出当前版本 JSON 报告
          </Button>
          <WordExport games={currentGames} label="导出当前版本 Word" />
        </div>
        <details>
          <summary>批量管理报告</summary>
          <ReportBulkActions
            games={visible}
            selected={selected}
            disabled={running || stopping}
            deleting={deleting}
            onSelect={setSelectedIds}
            onDelete={deleteReports}
          />
        </details>
      </section>
      {!visible.length && (
        <EmptyState
          icon={ChartNoAxesCombined}
          title="这里将记录每一次试玩"
          description="完成或暂停一场对局后，就能在这里查看结果、整理报告，以及比较不同实验。"
        >
          <Button
            variant="outline"
            onClick={() => (games.length ? setScope('all') : setTab('table'))}
          >
            {games.length ? '查看所有版本' : '前往牌桌'}
          </Button>
        </EmptyState>
      )}
      <div className="cq-report-table">
        {!!visible.length && (
          <div className="cq-report-columns" aria-hidden="true">
            <span>对局与规则</span>
            <span>模式</span>
            <span>状态</span>
            <span>进度</span>
            <span>操作</span>
          </div>
        )}
        <div className="cq-report-list">
          {visible.map((g) => {
            const checked = selected.some((chosen) => chosen.id === g.id);
            const report = reportFor(g);
            return (
              <article
                key={g.id}
                className={`${panel} cq-report-card`}
                data-selected={checked}
              >
                <div className="cq-report-header">
                  <Checkbox
                    id={`select-report-${g.id}`}
                    aria-label={`选择报告 ${g.title || g.id}`}
                    disabled={deleting || g.status === 'running'}
                    checked={checked}
                    onCheckedChange={(checked) =>
                      setSelectedIds((old) =>
                        checked
                          ? [...new Set([...old, g.id])]
                          : old.filter((id) => id !== g.id),
                      )
                    }
                  />
                  <div className="cq-report-title">
                    <h2>{g.title || `${g.rule.label} 试玩`}</h2>
                    <p>
                      {formatDate(g.createdAt)} · {g.rule.label}
                    </p>
                  </div>
                </div>
                <span className="cq-report-mode">
                  {g.mode === 'simulation' ? '免费模拟' : '真实 API'}
                </span>
                <div className="cq-report-state">
                  <GameStatus status={g.status} />
                </div>
                <div className="cq-report-summary">
                  <span>
                    <Clock3 size={13} aria-hidden="true" />
                    {g.state.round} 轮 / {g.state.turn} 回合
                  </span>
                  <span>
                    <Users size={13} aria-hidden="true" />
                    {g.state.players.length} 位玩家
                  </span>
                  <span>{g.calls.length} 次调用</span>
                  {g.status === 'complete' && (
                    <span>
                      <Trophy size={13} aria-hidden="true" />
                      {report.winner}
                    </span>
                  )}
                </div>
                <div className="cq-report-quick-actions">
                  <Button
                    variant="outline"
                    disabled={running || stopping || deleting}
                    onClick={() => selectGame(g)}
                  >
                    查看对局
                  </Button>
                  {g.status !== 'complete' && g.status !== 'terminated' && (
                    <Button
                      disabled={running || stopping || deleting}
                      onClick={() => void start(g.mode, g)}
                    >
                      继续对局
                    </Button>
                  )}
                </div>
                <details className="cq-report-details">
                  <summary>试玩指标、反思与报告管理</summary>
                  <V71Metrics game={g} />
                  {g.notes && (
                    <p className="whitespace-pre-wrap mt-3">备注：{g.notes}</p>
                  )}
                  {Object.entries(g.reflections).map(([id, text]) => (
                    <details key={id} className="mt-3">
                      <summary>
                        {g.state.players.find((p) => p.id === id)?.name} 的反思
                      </summary>
                      <p className="whitespace-pre-wrap mt-2">{text}</p>
                    </details>
                  ))}
                  <div className="cq-report-tools">
                    <Button
                      variant="outline"
                      onClick={() => download('game-' + g.id + '.json', g)}
                    >
                      导出完整记录
                    </Button>
                    <ReportActions
                      game={g}
                      disabled={
                        running ||
                        stopping ||
                        deleting ||
                        g.status === 'running'
                      }
                      onSave={saveReport}
                      onDelete={deleteReport}
                    />
                    {(g.status === 'complete' || g.status === 'terminated') && (
                      <Button
                        variant="outline"
                        disabled={running || stopping || deleting}
                        onClick={() => void repairSummaries(g)}
                      >
                        补生成总结
                      </Button>
                    )}
                  </div>
                </details>
              </article>
            );
          })}
        </div>
      </div>
      <details className={panel}>
        <summary>报告统计</summary>
        <p className="text-xs text-muted-foreground my-3">
          真实 API 与模拟独立统计，仅完成局计入胜率。
        </p>
        <div className="cq-metric-grid">
          <MetricCard
            icon={CheckCheck}
            label="已完成试玩"
            value={completed.length}
            detail="当前规则版本"
          />
          <MetricCard
            icon={Radio}
            label="API 对战"
            value={currentGames.filter((g) => g.mode === 'api').length}
            detail="当前版本 · 含未完成"
          />
          <MetricCard
            icon={FlaskConical}
            label="模拟检查"
            value={currentGames.filter((g) => g.mode === 'simulation').length}
            detail="当前版本 · 含未完成"
          />
        </div>
      </details>
      <LabAnalytics games={currentGames} />
    </TabsContent>
  );
}
