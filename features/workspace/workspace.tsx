'use client';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { MemoryPanel } from '@/features/memory/memory-panel';
import { LivePanel } from '@/features/playtest/live-panel';
import { ResumeDialog } from '@/features/playtest/resume-dialog';
import { SeatDialog } from '@/features/playtest/seat-dialog';
import { SingleMove } from '@/features/playtest/single-move';
import { TablePanel } from '@/features/playtest/table-panel';
import { TerminateDialog } from '@/features/playtest/terminate-dialog';
import { ReportsPanel } from '@/features/reports/reports-panel';
import { UNSUPPORTED_RELEASE_VERSION } from '@/lib/game/registry';
import { RulesPanel } from '@/features/rules/rules-panel';
import {
  BookOpen,
  Brain,
  ChartNoAxesCombined,
  Info,
  LayoutGrid,
  Pause,
  Diamond,
  Radio,
  ScrollText,
} from 'lucide-react';
import { useEffect, useRef } from 'react';
import { usePlaytestController } from './use-playtest-controller.ts';

const pages = [
  {
    id: 'table',
    label: '牌桌与 AI',
    icon: LayoutGrid,
    title: '牌桌与 AI',
    description: '配置测试小队，再选本局参数。',
  },
  {
    id: 'live',
    label: '实时对局',
    icon: Radio,
    title: '实时对局',
    description: '观察公开牌桌与桌聊，独立查看私有决策说明。',
  },
  {
    id: 'reports',
    label: '测试报告',
    icon: ChartNoAxesCombined,
    title: '测试报告',
    description: '回看对局、比较实验，保留版本和未完成状态的区别。',
  },
  {
    id: 'memory',
    label: '记忆库',
    icon: Brain,
    title: '记忆库',
    description: '管理反思与学习记录，明确谁能读取、适用于哪个版本。',
  },
  {
    id: 'rules',
    label: '规则文档',
    icon: ScrollText,
    title: '规则文档',
    description: '查看完整正文、回溯版本，或导入下一次修订。',
  },
];

export function PlaytestWorkspace() {
  const controller = usePlaytestController();
  const seatTrigger = useRef<HTMLButtonElement>(null);
  const {
    rule,
    running,
    ready,
    message,
    tab,
    setTab,
    games,
    memories,
    current,
    unsavedGame,
    unsupportedRecords,
  } = controller;
  const resumable =
    !running && !unsavedGame
      ? current?.status === 'paused'
        ? current
        : games.find((game) => game.status === 'paused')
      : undefined;
  const status = !ready
    ? '读取记录中'
    : unsavedGame
      ? '有记录待保存'
      : running
        ? '对局处理中'
        : current?.status === 'paused'
          ? '当前对局已暂停'
          : '准备就绪';
  const page = pages.find((item) => item.id === tab) || pages[0];
  const displayRule = tab === 'live' && current ? current.rule : rule;
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, [tab]);
  return (
    <main className="cq-workspace">
      <Tabs
        value={tab}
        onValueChange={setTab}
        orientation="horizontal"
        className="cq-shell"
      >
        <header className="cq-studio-header">
          <div className="cq-masthead">
            <a
              href="#workspace-content"
              className="cq-brand"
              aria-label="Critter Quest 试玩工作室"
            >
              <span className="cq-brand-mark">
                <Diamond size={25} strokeWidth={1.8} aria-hidden="true" />
              </span>
              <span>
                <strong>Critter Quest</strong>
                <small>实体桌游试玩工作室</small>
              </span>
            </a>
            <div className="cq-topbar-actions">
              <span
                className="cq-badge cq-version-badge"
                aria-label={tab === 'live' ? '本局规则' : '新局规则'}
              >
                {displayRule.label}
              </span>
              <span className="cq-header-status">
                <span className="cq-dot" />
                {status}
              </span>
              <Button variant="outline" onClick={() => setTab('rules')}>
                <BookOpen size={16} aria-hidden="true" />
                规则手册
              </Button>
            </div>
          </div>
          <TabsList className="cq-navigation" aria-label="工作室导航">
            {pages.map(({ id, label, icon: Icon }) => (
              <TabsTrigger
                key={id}
                value={id}
                aria-label={label}
                className="cq-nav-item"
              >
                <Icon size={19} strokeWidth={1.7} aria-hidden="true" />
                <span>{label}</span>
                {(id === 'reports' || id === 'memory') && (
                  <small className="cq-nav-count">
                    {id === 'reports' ? games.length : memories.length}
                  </small>
                )}
                {id === 'live' && running && <span className="cq-live-dot" />}
              </TabsTrigger>
            ))}
          </TabsList>
        </header>
        <div className="cq-main-column" id="workspace-content" tabIndex={-1}>
          <div className="cq-content" data-page={tab}>
            <div className="cq-page-top">
              <div className="cq-page-intro">
                {resumable && tab !== 'live' && (
                  <section
                    className="cq-recovery-strip"
                    aria-label="待继续的对局"
                  >
                    <div>
                      <strong>
                        <Pause size={15} aria-hidden="true" />
                        有一局已暂停
                      </strong>
                      <p>
                        {resumable.rule.label} ·{' '}
                        {resumable.mode === 'simulation'
                          ? '免费模拟'
                          : 'API 对战'}{' '}
                        · 第 {resumable.state.turn} 回合
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      onClick={() => controller.selectGame(resumable)}
                    >
                      查看并继续
                    </Button>
                  </section>
                )}
                <div className="cq-page-heading" data-page={tab}>
                  <div className="cq-heading-copy" key={tab}>
                    <h1>{page.title}</h1>
                    <p>{page.description}</p>
                  </div>
                </div>
              </div>
              <div aria-live="polite">
                {unsupportedRecords > 0 && (
                  <div className="cq-notice">
                    <Info size={17} aria-hidden="true" />
                    <span>
                      有 {unsupportedRecords} 条记录不适用于此版本。
                      {UNSUPPORTED_RELEASE_VERSION}
                    </span>
                  </div>
                )}
                {message && (
                  <div className="cq-notice" data-unsaved={!!unsavedGame}>
                    <Info size={17} aria-hidden="true" />
                    <span>{message}</span>
                  </div>
                )}
              </div>
            </div>
            {process.env.NODE_ENV === 'development' &&
              ready &&
              tab === 'table' &&
              !running && <SingleMove seats={controller.seats} />}
            <TablePanel
              {...controller}
              openSeat={(index, trigger) => {
                seatTrigger.current = trigger;
                controller.setEdit(index);
              }}
            />
            <LivePanel {...controller} />
            <RulesPanel {...controller} />
            <MemoryPanel {...controller} />
            <ReportsPanel {...controller} />
            <footer className="cq-page-footer">
              <Diamond size={13} aria-hidden="true" />
              <span>Critter Quest · 漫画试玩工作室</span>
            </footer>
          </div>
        </div>
      </Tabs>
      <ResumeDialog {...controller} />
      <TerminateDialog {...controller} />
      <SeatDialog {...controller} returnFocus={seatTrigger} />
    </main>
  );
}
