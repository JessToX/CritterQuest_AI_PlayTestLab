'use client';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import type { GameRecord } from '@/lib/playtest/types';
import { useState } from 'react';
export function WordExport({
  games,
  label = '导出 Word',
  disabled = false,
}: {
  games: GameRecord[];
  label?: string;
  disabled?: boolean;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  return (
    <>
      <Button
        disabled={disabled || busy || !games.length}
        variant="outline"
        onClick={() => {
          setBusy(true);
          setError('');
          void import('@/lib/reports/docx')
            .then((m) => m.exportReports(games))
            .catch(() => setError('Word 导出失败，请重试'))
            .finally(() => setBusy(false));
        }}
      >
        {busy ? '正在生成 Word…' : label}
      </Button>
      {error && <p role="alert">{error}</p>}
    </>
  );
}
export function ReportActions({
  game,
  disabled,
  onSave,
  onDelete,
}: {
  game: GameRecord;
  disabled: boolean;
  onSave: (g: GameRecord) => Promise<void>;
  onDelete: (g: GameRecord) => Promise<void>;
}) {
  const [mode, setMode] = useState(''),
    [title, setTitle] = useState(''),
    [notes, setNotes] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  return (
    <>
      <WordExport games={[game]} />
      <Button
        disabled={disabled}
        variant="outline"
        onClick={() => {
          setTitle(game.title || '');
          setNotes(game.notes || '');
          setMode('edit');
          setError('');
        }}
      >
        编辑标题与备注
      </Button>
      <Button
        disabled={disabled}
        variant="outline"
        onClick={() => {
          setMode('delete');
          setError('');
        }}
      >
        删除报告
      </Button>
      <Dialog
        open={!!mode}
        onOpenChange={(v) => {
          if (!v && !busy) setMode('');
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {mode === 'edit' ? '编辑报告' : '删除报告与对局'}
            </DialogTitle>
            <DialogDescription>
              {mode === 'edit'
                ? '只修改标题与备注，原始对局数据及反思保持不变。'
                : '同时删除对局，保留已生成记忆。此操作无法撤销。'}
            </DialogDescription>
          </DialogHeader>
          {mode === 'edit' && (
            <>
              <Input
                aria-label="报告标题"
                placeholder="报告标题"
                maxLength={200}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
              <Textarea
                aria-label="报告备注"
                placeholder="你的备注"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </>
          )}
          {error && <p role="alert">{error}</p>}
          <Button
            disabled={busy || disabled}
            onClick={() => {
              setBusy(true);
              void (
                mode === 'edit'
                  ? onSave({ ...game, title, notes })
                  : onDelete(game)
              )
                .then(() => setMode(''))
                .catch((e) => setError(e.message))
                .finally(() => setBusy(false));
            }}
          >
            {mode === 'edit' ? '保存修改' : '确认删除'}
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
}
