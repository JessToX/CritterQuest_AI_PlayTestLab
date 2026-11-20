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
import { needsResumeInput } from '@/lib/playtest/resume';
import type { Dispatch, SetStateAction } from 'react';
import type { StartPlaytest } from '@/lib/playtest/commands';
import type { ResumePrompt } from './view-types';

interface Props {
  resumePrompt: ResumePrompt;
  setResumePrompt: Dispatch<SetStateAction<ResumePrompt>>;
  resumeError: string;
  running: boolean;
  setResumeError: Dispatch<SetStateAction<string>>;
  start: StartPlaytest;
}
export function ResumeDialog({
  resumePrompt,
  setResumePrompt,
  resumeError,
  running,
  setResumeError,
  start,
}: Props) {
  return (
    <Dialog
      open={!!resumePrompt}
      onOpenChange={(open) => {
        if (!open) setResumePrompt(null);
      }}
    >
      <DialogContent className="cq-dialog max-h-[90dvh] overflow-auto">
        <DialogHeader>
          <DialogTitle>补齐旧对局连接</DialogTitle>
          <DialogDescription>
            已恢复旧局模型、提示词和记忆设置。这里只补充缺失接口或
            Key，不会改变当前牌桌的新局配置。
          </DialogDescription>
        </DialogHeader>
        {resumePrompt?.seats.map((s, i) => (
          <div key={s.profile.id} className="space-y-2">
            <p>
              {s.profile.name} · {s.connection.label} · {s.profile.model}
            </p>
            <Input
              aria-label={s.profile.name + ' 接口地址'}
              value={s.connection.baseUrl || ''}
              disabled={
                !!resumePrompt.game.seats[i].connectionFingerprint ||
                !!resumePrompt.game.seats[i].connection ||
                s.connection.kind !== 'openai-compatible'
              }
              placeholder="旧局使用的 HTTPS Base URL"
              onChange={(e) =>
                setResumePrompt({
                  ...resumePrompt,
                  seats: resumePrompt.seats.map((v, n) =>
                    n === i
                      ? {
                          ...v,
                          connection: {
                            ...v.connection,
                            baseUrl: e.target.value,
                          },
                        }
                      : v,
                  ),
                })
              }
            />
            <Input
              type="password"
              autoComplete="off"
              aria-label={s.profile.name + ' API Key'}
              placeholder="填写这个接口对应的 API Key"
              value={s.connection.apiKey}
              onChange={(e) =>
                setResumePrompt({
                  ...resumePrompt,
                  seats: resumePrompt.seats.map((v, n) =>
                    n === i
                      ? {
                          ...v,
                          connection: {
                            ...v.connection,
                            apiKey: e.target.value,
                          },
                        }
                      : v,
                  ),
                })
              }
            />
          </div>
        ))}
        {resumeError && <p role="alert">{resumeError}</p>}
        <Button
          disabled={running}
          onClick={() => {
            if (!resumePrompt) return;
            if (needsResumeInput(resumePrompt.seats, resumePrompt.game.mode)) {
              setResumeError('请补齐每个 AI 的接口地址与 API Key');
              return;
            }
            for (const s of resumePrompt.seats) {
              try {
                if (new URL(s.connection.baseUrl || '').protocol !== 'https:')
                  throw Error();
              } catch {
                setResumeError('接口地址须为完整 HTTPS 地址');
                return;
              }
            }
            const target = resumePrompt;
            setResumePrompt(null);
            void start(target.game.mode, target.game, target.seats);
          }}
        >
          保存连接并继续旧局
        </Button>
      </DialogContent>
    </Dialog>
  );
}
