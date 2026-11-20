'use client';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { download } from '@/lib/client/download';
import type { GameRecord } from '@/lib/playtest/types';
import type { ReportDeletionResult } from '@/lib/reports/management';
import { reportFor } from '@/lib/reports/report';
import { useState } from 'react';
import { WordExport } from './report-actions';

export function ReportBulkActions({
  games,
  selected,
  disabled,
  deleting,
  onSelect,
  onDelete,
}: {
  games: GameRecord[];
  selected: GameRecord[];
  disabled: boolean;
  deleting: boolean;
  onSelect: (ids: string[]) => void;
  onDelete: (games: GameRecord[]) => Promise<ReportDeletionResult>;
}) {
  const [pending, setPending] = useState<GameRecord[] | null>(null);
  const [notice, setNotice] = useState('');
  const [failures, setFailures] = useState<ReportDeletionResult['failures']>(
    [],
  );
  const [error, setError] = useState('');
  const selectable = games.filter((g) => g.status !== 'running');
  return (
    <>
      <div className="cq-bulk-controls">
        <div className="flex flex-wrap items-center gap-3">
          <label
            htmlFor="select-all-reports"
            className="flex items-center gap-2"
          >
            <Checkbox
              id="select-all-reports"
              disabled={deleting || !selectable.length}
              checked={
                !!selectable.length && selected.length === selectable.length
              }
              indeterminate={
                selected.length > 0 && selected.length < selectable.length
              }
              onCheckedChange={(checked) =>
                onSelect(checked ? selectable.map((g) => g.id) : [])
              }
            />
            全选当前列表
          </label>
          <output>
            已选 {selected.length} / {selectable.length} 份
          </output>
          <Button
            variant="outline"
            disabled={deleting || !selected.length}
            onClick={() => onSelect([])}
          >
            取消选择
          </Button>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button
            variant="destructive"
            disabled={disabled || deleting || !selected.length}
            onClick={() => {
              setPending([...selected]);
              setError('');
            }}
          >
            删除所选报告
          </Button>
          <Button
            variant="outline"
            disabled={deleting || !selected.length}
            onClick={() =>
              download(
                'critter-quest-selected-reports.json',
                selected.map((g) => ({
                  ...reportFor(g),
                  reflections: g.reflections,
                })),
              )
            }
          >
            导出选中 JSON
          </Button>
          <WordExport
            games={selected}
            label="导出选中 Word"
            disabled={deleting}
          />
        </div>
      </div>
      {games.length > selectable.length && (
        <p className="text-sm text-slate-400">
          {games.length - selectable.length}{' '}
          份运行中报告暂不可选择，请先暂停或终止对局。
        </p>
      )}
      {disabled && (
        <p className="text-sm text-slate-400">
          对局运行或保存期间暂不可删除报告。
        </p>
      )}
      {notice && <output className="block">{notice}</output>}
      {!!failures.length && (
        <details>
          <summary>查看 {failures.length} 份删除失败的原因</summary>
          <ul className="space-y-2 text-sm break-all">
            {failures.map((failure) => (
              <li key={failure.id}>
                {failure.id}：{failure.message}
              </li>
            ))}
          </ul>
        </details>
      )}
      <Dialog
        open={!!pending}
        onOpenChange={(open) => {
          if (!open && !deleting) setPending(null);
        }}
      >
        <DialogContent
          className="cq-dialog max-h-[85dvh] overflow-auto"
          showCloseButton={!deleting}
        >
          <DialogHeader>
            <DialogTitle>批量删除 {pending?.length || 0} 份报告</DialogTitle>
            <DialogDescription>
              将同时删除所选报告与对应对局，保留已生成的记忆。此操作无法撤销。
            </DialogDescription>
          </DialogHeader>
          <ul className="max-h-48 overflow-auto space-y-2 text-sm">
            {pending?.map((g) => (
              <li key={g.id}>
                {g.title || g.rule.label} ·{' '}
                {g.mode === 'simulation' ? '模拟' : 'API'}
                <span className="block text-slate-400 break-all">
                  {g.createdAt} · {g.id}
                </span>
              </li>
            ))}
          </ul>
          {error && <p role="alert">{error}</p>}
          <div className="flex flex-wrap justify-end gap-3">
            <Button
              variant="outline"
              disabled={deleting}
              onClick={() => setPending(null)}
            >
              取消
            </Button>
            <Button
              variant="destructive"
              disabled={disabled || deleting || !pending?.length}
              onClick={async () => {
                if (!pending) return;
                setError('');
                try {
                  const result = await onDelete(pending);
                  onSelect(result.failures.map((failure) => failure.id));
                  setFailures(result.failures);
                  setNotice(
                    `已删除 ${result.deletedIds.length} 份报告${result.failures.length ? `；${result.failures.length} 份失败，已保留选中，可重试` : ''}。`,
                  );
                  setPending(null);
                } catch (e) {
                  setError(e instanceof Error ? e.message : '删除失败，请重试');
                }
              }}
            >
              {deleting
                ? '正在删除…'
                : `确认删除 ${pending?.length || 0} 份报告`}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
