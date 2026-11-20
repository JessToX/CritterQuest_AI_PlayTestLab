'use client';
import { EmptyState, formatDate } from '@/components/lab/primitives';
import { Brain } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  NativeSelect,
  NativeSelectOption,
} from '@/components/ui/native-select';
import { Textarea } from '@/components/ui/textarea';
import { deleteSelectedMemories, enrichMemory } from '@/lib/memory/management';
import { memoryKey } from '@/lib/memory/selection';
import type { MemoryEntry } from '@/lib/memory/types';
import { type GameRecord, type Seat } from '@/lib/playtest/types';
import { useState } from 'react';
export function MemoryManager({
  entries,
  games,
  seats,
  running,
  onSave,
  onDelete,
}: {
  entries: MemoryEntry[];
  games: GameRecord[];
  seats: Seat[];
  running: boolean;
  onSave: (m: MemoryEntry) => Promise<void>;
  onDelete: (m: MemoryEntry) => Promise<void>;
}) {
  const [selected, setSelected] = useState<string[]>([]);
  const [batchConfirm, setBatchConfirm] = useState(false);
  const [notice, setNotice] = useState('');
  const [filter, setFilter] = useState('');
  const [draft, setDraft] = useState<MemoryEntry | null>(null);
  const [deleting, setDeleting] = useState<MemoryEntry | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const all = entries.map((m) => enrichMemory(m, games));
  const visible = all.filter((m) => !filter || m.agentId === filter);
  const chosen = visible.filter((m) => selected.includes(m.id));
  const label = (m: MemoryEntry) =>
    `${m.author?.name} · ${m.author?.seatId} · ${m.author?.provider} · ${m.author?.model}`;
  async function act(fn: () => Promise<void>) {
    setBusy(true);
    setError('');
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : '保存失败');
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="space-y-4">
      <section className="cq-memory-toolbar" aria-label="记忆筛选">
        <label htmlFor="memory-author-filter">作者</label>
        <NativeSelect
          id="memory-author-filter"
          aria-label="按原作者筛选"
          value={filter}
          onChange={(e) => {
            setFilter(e.target.value);
            setSelected([]);
          }}
        >
          <NativeSelectOption value="">全部原作者</NativeSelectOption>
          {Array.from(new Map(all.map((m) => [m.agentId, m])).values()).map(
            (m) => (
              <NativeSelectOption key={m.agentId} value={m.agentId}>
                {label(m)}
              </NativeSelectOption>
            ),
          )}
        </NativeSelect>
        <p className="text-xs text-muted-foreground">
          {all.length} 条记录 · {all.filter((m) => m.active).length} 条已启用
        </p>
        <details className="cq-memory-bulk">
          <summary>批量管理与读取权限说明</summary>
          <p className="text-xs text-muted-foreground my-3">
            反思默认仅原作者可读。你可以授权具体 Agent
            和模型读取，规则版本与模拟／真实模式独立。
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <label
              htmlFor="select-all-memory"
              className="flex items-center gap-2"
            >
              <Checkbox
                id="select-all-memory"
                disabled={running || busy || !visible.length}
                checked={!!visible.length && chosen.length === visible.length}
                indeterminate={
                  chosen.length > 0 && chosen.length < visible.length
                }
                onCheckedChange={(checked) =>
                  setSelected(checked ? visible.map((m) => m.id) : [])
                }
              />
              全选当前筛选结果
            </label>
            <span>已选 {chosen.length} 条</span>
            <Button
              disabled={running || busy || !chosen.length}
              variant="outline"
              onClick={() => {
                setError('');
                setBatchConfirm(true);
              }}
            >
              删除所选记忆
            </Button>
            <Button
              disabled={busy || !selected.length}
              variant="outline"
              onClick={() => setSelected([])}
            >
              取消选择
            </Button>
          </div>
        </details>
        {notice && <output>{notice}</output>}
        {error && <p role="alert">{error}</p>}
      </section>
      {!visible.length && (
        <EmptyState
          icon={Brain}
          title={all.length ? '这个作者还没有匹配的记忆' : '给下一局留一点经验'}
          description="对局反思生成后，会保存在这里。你可以编辑、启停记忆，并管理其他 AI 的读取授权。"
        />
      )}
      <div className="cq-memory-grid">
        {visible
          .slice()
          .reverse()
          .map((m) => (
            <article
              key={m.id}
              className="cq-panel cq-memory-card space-y-3"
              data-selected={selected.includes(m.id)}
            >
              <div className="cq-memory-heading">
                <label
                  htmlFor={`select-memory-${m.id}`}
                  className="flex items-center gap-2"
                >
                  <Checkbox
                    id={`select-memory-${m.id}`}
                    aria-label={`选择 ${label(m)} 的${m.kind === 'episode' ? '单局反思' : '十局总结'} ${m.createdAt}`}
                    disabled={running || busy}
                    checked={selected.includes(m.id)}
                    onCheckedChange={(checked) =>
                      setSelected((old) =>
                        checked
                          ? [...new Set([...old, m.id])]
                          : old.filter((id) => id !== m.id),
                      )
                    }
                  />
                  <span className="sr-only">选择此记忆</span>
                </label>
                <h2>
                  {m.author?.name || '历史作者'} 的
                  {m.kind === 'episode' ? '单局反思' : '十局总结'}
                </h2>
                <span
                  className="cq-badge"
                  data-status={m.active ? 'complete' : 'terminated'}
                >
                  {m.active ? '已启用' : '已停用'}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                原作者：{label(m)}
              </p>
              <p className="text-sm">
                {m.ruleVersion} ·{' '}
                {m.mode === 'api'
                  ? '真实 API'
                  : m.mode === 'simulation'
                    ? '模拟'
                    : '模式信息缺失'}{' '}
                · {formatDate(m.createdAt)}
              </p>
              <div className="cq-memory-access">
                <span className="cq-badge">
                  {m.allowedReaders?.length
                    ? `原作者及 ${m.allowedReaders.length} 个授权配置可读`
                    : '仅原作者可读'}
                </span>
              </div>
              {m.outcome === 'terminated' && (
                <p>未完成局的收尾反思；不计入十个完成局汇总。</p>
              )}
              {m.strategyBatchId && (
                <p className="text-sm">
                  已纳入长期总结批次，删除或停用后不会重复汇总。
                </p>
              )}
              <p className="cq-memory-preview whitespace-pre-wrap">
                {m.content.length > 180
                  ? m.content.slice(0, 180) + '…'
                  : m.content}
              </p>
              <details>
                <summary>完整记忆与来源</summary>
                <p className="text-xs text-muted-foreground break-all mb-3">
                  来源：
                  {m.sourceGameIds
                    .map(
                      (id) =>
                        `${id}${games.some((g) => g.id === id) ? '' : '（来源已删除或历史记录缺失）'}`,
                    )
                    .join('、')}
                </p>
                <p className="whitespace-pre-wrap">{m.content}</p>
                {m.editedAt && (
                  <details>
                    <summary>人工修改于 {m.editedAt} · 查看 AI 原文</summary>
                    <p className="whitespace-pre-wrap">{m.originalContent}</p>
                  </details>
                )}
              </details>
              <div className="flex flex-wrap gap-2">
                <Button
                  disabled={running || busy}
                  variant="outline"
                  onClick={() => setDraft(structuredClone(m))}
                >
                  编辑与读取授权
                </Button>
                <Button
                  disabled={running || busy}
                  variant="outline"
                  onClick={() =>
                    void act(() => onSave({ ...m, active: !m.active }))
                  }
                >
                  {m.active ? '停用' : '启用'}
                </Button>
                <Button
                  disabled={running || busy}
                  variant="outline"
                  onClick={() => setDeleting(m)}
                >
                  删除记忆
                </Button>
              </div>
            </article>
          ))}
      </div>
      <Dialog
        open={batchConfirm}
        onOpenChange={(v) => {
          if (!busy) setBatchConfirm(v);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>批量删除 {chosen.length} 条记忆</DialogTitle>
            <DialogDescription>
              只删除当前勾选的记忆，所有获授权 AI
              也将无法再读取。原始对局和报告保留。删除不能撤销。
            </DialogDescription>
          </DialogHeader>
          <p>涉及原作者：{[...new Set(chosen.map(label))].join('；')}</p>
          {error && <p role="alert">{error}</p>}
          <Button
            disabled={busy || running || !chosen.length}
            onClick={() =>
              void act(async () => {
                const { deleted, failures } = await deleteSelectedMemories(
                  chosen,
                  onDelete,
                );
                setSelected(failures);
                setNotice(
                  `已删除 ${deleted} 条记忆${failures.length ? `，${failures.length} 条失败，已保留勾选，可重试` : ''}`,
                );
                setBatchConfirm(false);
              })
            }
          >
            {busy ? '正在删除…' : '确认批量删除'}
          </Button>
        </DialogContent>
      </Dialog>
      <Dialog
        open={!!draft}
        onOpenChange={(v) => {
          if (!v && !busy) setDraft(null);
        }}
      >
        <DialogContent className="max-h-[90dvh] overflow-auto">
          <DialogHeader>
            <DialogTitle>编辑反思与读取权限</DialogTitle>
            <DialogDescription>
              原作者不会改变，修改正文会保留 AI 原文并标记人工修改。
            </DialogDescription>
          </DialogHeader>
          {draft && (
            <>
              <p>原作者：{label(draft)}</p>
              <Textarea
                aria-label="反思正文"
                rows={8}
                value={draft.content}
                onChange={(e) =>
                  setDraft({ ...draft, content: e.target.value })
                }
              />
              <p>允许读取的其他 AI</p>
              {seats.map((s) => {
                const key = memoryKey(s, draft.ruleVersion, draft.mode || '');
                const owner = key === draft.agentId;
                return (
                  <label key={key} className="flex items-center gap-2">
                    <Checkbox
                      disabled={owner || !draft.mode}
                      checked={
                        owner || draft.allowedReaders?.includes(key) || false
                      }
                      onCheckedChange={(checked) =>
                        setDraft({
                          ...draft,
                          allowedReaders: checked
                            ? [
                                ...new Set([
                                  ...(draft.allowedReaders || []),
                                  key,
                                ]),
                              ]
                            : (draft.allowedReaders || []).filter(
                                (k) => k !== key,
                              ),
                        })
                      }
                    />
                    {s.profile.name} · {s.connection.label} ·{' '}
                    {s.profile.model || '未配置模型'}
                    {owner ? '（原作者）' : ''}
                  </label>
                );
              })}
              {(draft.allowedReaders || [])
                .filter(
                  (k) =>
                    !seats.some(
                      (s) =>
                        memoryKey(s, draft.ruleVersion, draft.mode || '') === k,
                    ),
                )
                .map((k) => (
                  <label key={k} className="flex gap-2 break-all">
                    <Checkbox
                      checked
                      onCheckedChange={() =>
                        setDraft({
                          ...draft,
                          allowedReaders: draft.allowedReaders?.filter(
                            (v) => v !== k,
                          ),
                        })
                      }
                    />
                    历史授权 {k}
                  </label>
                ))}
              {error && <p role="alert">{error}</p>}
              <Button
                disabled={busy || running || !draft.content.trim()}
                onClick={() =>
                  void act(async () => {
                    const old = entries.find((m) => m.id === draft.id)!;
                    await onSave({
                      ...draft,
                      ...(old.content !== draft.content
                        ? {
                            originalContent: old.originalContent ?? old.content,
                            editedAt: new Date().toISOString(),
                          }
                        : {}),
                    });
                    setDraft(null);
                  })
                }
              >
                保存修改
              </Button>
            </>
          )}
        </DialogContent>
      </Dialog>
      <Dialog
        open={!!deleting}
        onOpenChange={(v) => {
          if (!v && !busy) setDeleting(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>删除这条记忆</DialogTitle>
            <DialogDescription>
              删除后所有 AI 均无法再读取此条记忆；原始报告保留。
            </DialogDescription>
          </DialogHeader>
          {error && <p role="alert">{error}</p>}
          <Button
            disabled={busy || running}
            onClick={() =>
              void act(async () => {
                await onDelete(deleting!);
                setDeleting(null);
              })
            }
          >
            确认删除记忆
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
