'use client';
import { PreferredCritterPortrait } from '@/components/lab/critter-portrait';
import {
  NativeSelect,
  NativeSelectOption,
} from '@/components/ui/native-select';
import {
  Brain,
  ChevronDown,
  Leaf,
  MessageCircle,
  Settings2,
  SlidersHorizontal,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { TabsContent } from '@/components/ui/tabs';
import { ExperimentControls } from '@/features/playtest/experiment-controls';
import { engineRegistration } from '@/lib/game/registry';
import {
  type ExperimentConfig,
  type ExperimentPreset,
} from '@/lib/playtest/experiment';
import type { Seat } from '@/lib/playtest/types';
import type { RuleVersion } from '@/lib/rules/types';
import { useRef, useState, type Dispatch, type SetStateAction } from 'react';
import type { StartPlaytest } from '@/lib/playtest/commands';

const readyLines = [
  '牌摆好了，开桌吧！',
  '等等，我再理一下手牌！',
  '市场开张，桌上见！',
  '规则翻到这页，开始吧。',
];

interface Props {
  seats: Seat[];
  panel: string;
  running: boolean;
  update: (index: number, patch: Partial<Seat>) => void;
  openSeat: (index: number, trigger: HTMLButtonElement) => void;
  count: number;
  setCount: Dispatch<SetStateAction<number>>;
  maxCalls: number;
  setMaxCalls: Dispatch<SetStateAction<number>>;
  experiment: ExperimentConfig;
  setExperiment: Dispatch<SetStateAction<ExperimentConfig>>;
  rule: RuleVersion;
  busy: boolean;
  savingProfiles: boolean;
  experimentPresets: ExperimentPreset[];
  savePreset: (name: string) => Promise<void>;
  loadPreset: (preset: ExperimentPreset) => void;
  deletePreset: (id: string) => Promise<void>;
  chat: boolean;
  setChat: Dispatch<SetStateAction<boolean>>;
  ready: boolean;
  start: StartPlaytest;
  message: string;
}
export function TablePanel({
  seats,
  panel,
  running,
  update,
  openSeat,
  count,
  setCount,
  maxCalls,
  setMaxCalls,
  experiment,
  setExperiment,
  rule,
  busy,
  savingProfiles,
  experimentPresets,
  savePreset,
  loadPreset,
  deletePreset,
  chat,
  setChat,
  ready,
  start,
}: Props) {
  const capabilities = engineRegistration(rule.config).capabilities;
  const enabled = seats.filter((seat) => seat.enabled).length;
  const validSeats = enabled >= capabilities.minimumPlayers && enabled <= 4;
  const [focusedSeat, setFocusedSeat] = useState(0);
  const [mode, setMode] = useState<'simulation' | 'api'>('simulation');
  const runCard = useRef<HTMLElement>(null);
  const focus = seats[focusedSeat] || seats[0];
  return (
    <TabsContent value="table">
      <div className="cq-setup-grid">
        <section className="cq-cast-panel" aria-label="测试小队">
          <div className="cq-section-heading">
            <h2>选好测试小队</h2>
            <span>{enabled} / 4 个座位已加入</span>
          </div>
          <div className="cq-comic-scene">
            <p className="cq-scene-title">
              小队<span>集结！</span>
            </p>
            <div className="cq-hero-shot" data-enabled={focus.enabled}>
              <PreferredCritterPortrait
                key={`${focusedSeat}-${focus.enabled}`}
                seatId={focus.profile.id}
                paused={!focus.enabled}
                className="cq-hero-portrait"
              />
              <span className="cq-shot-label">座位 {'ABCD'[focusedSeat]}</span>
            </div>
            <div className="cq-scene-copy" aria-live="polite">
              <div className="cq-speech" key={focusedSeat}>
                <strong>{focus.profile.name}</strong>
                <p>
                  {focus.enabled
                    ? readyLines[focusedSeat]
                    : '这局我先在旁边看。'}
                </p>
              </div>
            </div>
          </div>
          <div className="cq-team-grid">
            {seats.map((s, i) => (
              <article
                key={s.profile.id}
                className={`${panel} cq-seat-card`}
                data-tone={i % 4}
                data-enabled={s.enabled}
                data-focused={i === focusedSeat}
              >
                <button
                  type="button"
                  className="cq-cast-select"
                  aria-label={`聚焦座位 ${s.profile.name}`}
                  aria-pressed={i === focusedSeat}
                  onClick={() => setFocusedSeat(i)}
                >
                  <PreferredCritterPortrait
                    seatId={s.profile.id}
                    paused={!s.enabled}
                  />
                  <span className="cq-cast-letter" aria-hidden="true">
                    {'ABCD'[i]}
                  </span>
                  <span className="cq-cast-state">
                    {s.enabled ? '已加入' : '待命'}
                  </span>
                </button>
                <div className="cq-seat-header">
                  <div>
                    <h3>{s.profile.name}</h3>
                    <p>{s.connection.label}</p>
                  </div>
                  <Switch
                    disabled={running}
                    checked={s.enabled}
                    onCheckedChange={(enabled) => update(i, { enabled })}
                    aria-label={'启用 ' + s.profile.name}
                  />
                </div>
                <div className="cq-seat-model">
                  <strong title={s.profile.model || undefined}>
                    {s.profile.model ||
                      (s.enabled ? '等待选择模型' : '暂不参与')}
                  </strong>
                </div>
                <div className="cq-seat-meta">
                  <span>
                    <Brain size={12} aria-hidden="true" />
                    {s.profile.memoryMode === 'active'
                      ? '读取并学习'
                      : s.profile.memoryMode === 'frozen'
                        ? '冻结，只读取'
                        : '记忆已关闭'}
                  </span>
                  <span>
                    {s.profile.customInstructions
                      ? '已设置专属提示'
                      : '默认提示'}
                  </span>
                </div>
                <Button
                  variant="outline"
                  disabled={running}
                  onClick={(event) => {
                    setFocusedSeat(i);
                    openSeat(i, event.currentTarget);
                  }}
                >
                  <Settings2 size={13} aria-hidden="true" />
                  配置座位
                </Button>
              </article>
            ))}
          </div>
          <div className="cq-team-note">
            <Leaf size={20} strokeWidth={1.5} aria-hidden="true" />
            <p>
              免费模拟无需 API Key。启用 {capabilities.minimumPlayers}–4
              个座位，就能先体验完整流程。
            </p>
          </div>
        </section>
        <section
          className={`${panel} cq-run-card`}
          ref={runCard}
          tabIndex={-1}
          aria-label="本局设置与开局"
        >
          <div className="cq-run-header">
            <div>
              <h2>本局怎么测</h2>
              <p>
                {rule.label} · {enabled} 位参与者
              </p>
            </div>
            <span className="cq-run-status" data-running={running}>
              {running ? '进行中' : validSeats ? '准备就绪' : '等待座位'}
            </span>
          </div>
          <div className="cq-run-body">
            <div className="cq-run-mode">
              <Label htmlFor="play-mode">对局方式</Label>
              <NativeSelect
                id="play-mode"
                value={mode}
                disabled={running || busy}
                onChange={(event) =>
                  setMode(event.target.value === 'api' ? 'api' : 'simulation')
                }
              >
                <NativeSelectOption value="simulation">
                  免费模拟 · 不调用模型
                </NativeSelectOption>
                <NativeSelectOption value="api">
                  API 对战 · 按供应商计费
                </NativeSelectOption>
              </NativeSelect>
              <p className="cq-cost-note">
                {mode === 'simulation'
                  ? '先检查完整流程，再评估真实模型。'
                  : '启用的座位须配置模型和 API Key。'}
              </p>
            </div>
            <div>
              <Label htmlFor="play-goal">获胜目标</Label>
              <NativeSelect
                id="play-goal"
                value={experiment.ordersToWin ?? rule.config.ordersToWin ?? 3}
                disabled={running || busy}
                onChange={(e) =>
                  setExperiment((old) => ({
                    ...old,
                    ordersToWin: Number(e.target.value) as 2 | 3,
                  }))
                }
              >
                <NativeSelectOption value={3}>
                  标准 · 完成 3 单
                </NativeSelectOption>
                <NativeSelectOption value={2}>
                  快速 · 完成 2 单
                </NativeSelectOption>
              </NativeSelect>
            </div>
            <div>
              <Label htmlFor="play-food-limit">食物上限</Label>
              <NativeSelect
                id="play-food-limit"
                value={experiment.foodLimitOverride === 0 ? 'none' : 'rule'}
                disabled={running || busy}
                onChange={(e) =>
                  setExperiment((old) => ({
                    ...old,
                    foodLimitOverride:
                      e.target.value === 'none' ? 0 : undefined,
                  }))
                }
              >
                <NativeSelectOption value="rule">
                  按规则 ·{' '}
                  {rule.config.foodLimit
                    ? `${rule.config.foodLimit} 张`
                    : '无上限'}
                </NativeSelectOption>
                <NativeSelectOption value="none">
                  取消食物上限
                </NativeSelectOption>
              </NativeSelect>
            </div>
            <div className="cq-form-row">
              <div>
                <Label htmlFor="count">连续局数</Label>
                <Input
                  id="count"
                  type="number"
                  min={1}
                  max={100}
                  value={count}
                  disabled={running}
                  onChange={(e) =>
                    setCount(Math.min(100, Math.max(1, Number(e.target.value))))
                  }
                />
              </div>
              <div>
                <Label htmlFor="calls">每局调用上限</Label>
                <Input
                  id="calls"
                  type="number"
                  min={10}
                  max={10000}
                  value={maxCalls}
                  disabled={running}
                  onChange={(e) =>
                    setMaxCalls(
                      Math.min(10000, Math.max(10, Number(e.target.value))),
                    )
                  }
                />
              </div>
            </div>
            <div className="cq-toggle-line">
              <div>
                <Label htmlFor="chat">
                  <MessageCircle size={13} aria-hidden="true" /> 公开桌聊
                </Label>
                <p>其他 AI 每回合各回应一次</p>
              </div>
              <Switch
                id="chat"
                checked={chat}
                disabled={running}
                onCheckedChange={setChat}
              />
            </div>
            <div className="cq-start-actions">
              <Button
                disabled={
                  !ready || running || busy || savingProfiles || !validSeats
                }
                aria-describedby="cq-run-cost"
                onClick={() => void start(mode)}
              >
                {mode === 'simulation' ? '开始免费模拟' : '开始 API 对战'}
              </Button>
            </div>
            <p className="cq-cost-note" id="cq-run-cost">
              API
              对战与连接测试按供应商计费。免费模拟不调用模型，不代表模型实力。
            </p>
          </div>
        </section>
      </div>
      <details className="cq-advanced">
        <summary>
          <SlidersHorizontal size={16} aria-hidden="true" />
          <span>实验设置与预设</span>
          <span className="text-xs text-muted-foreground">
            随机方式与记忆预算
          </span>
          <ChevronDown size={15} aria-hidden="true" />
        </summary>
        <ExperimentControls
          value={experiment}
          onChange={setExperiment}
          disabled={running || busy}
          presets={experimentPresets}
          onSave={savePreset}
          onLoad={loadPreset}
          onDelete={async (p) => {
            await deletePreset(p.id);
          }}
        />
        <p className="text-xs text-muted-foreground mt-5">
          每 10 个完整轮次各自总结，结束或终止时补总结；学习模式每累计 10
          个完成局形成长期总结。桌聊失败记录后继续，决策失败保存并暂停。
        </p>
      </details>
      <div className="cq-mobile-run">
        <Button
          variant="outline"
          onClick={() => {
            runCard.current?.scrollIntoView({
              block: 'start',
              behavior: 'instant',
            });
            runCard.current?.focus({ preventScroll: true });
          }}
        >
          前往本局设置与开局
        </Button>
      </div>
    </TabsContent>
  );
}
