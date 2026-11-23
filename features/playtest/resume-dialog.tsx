'use client';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  credentialEndpoint,
  editProviderConnection,
  providerBaseUrl,
} from '@/lib/agents/provider-endpoint';
import { Input } from '@/components/ui/input';
import { needsResumeInput } from '@/lib/playtest/resume';
import type { Dispatch, SetStateAction } from 'react';
import type { ResumePrompt } from './view-types';

interface Props {
  resumePrompt: ResumePrompt;
  setResumePrompt: Dispatch<SetStateAction<ResumePrompt>>;
  resumeError: string;
  running: boolean;
  setResumeError: Dispatch<SetStateAction<string>>;
}
export function ResumeDialog({
  resumePrompt,
  setResumePrompt,
  resumeError,
  running,
  setResumeError,
}: Props) {
  const required = (index: number) =>
    !resumePrompt?.playerId ||
    resumePrompt.playerId === resumePrompt.game.state.players[index]?.id;
  return (
    <Dialog
      open={!!resumePrompt}
      onOpenChange={(open) => {
        if (!open) setResumePrompt(null);
      }}
    >
      <DialogContent className="cq-dialog max-h-[90dvh] overflow-auto">
        <DialogHeader>
          <DialogTitle>
            {resumePrompt?.summary ? '确认补总结连接' : '补齐旧对局连接'}
          </DialogTitle>
          <DialogDescription>
            已恢复旧局的模型、提示词和记忆设置。请核对原供应商的 HTTPS 接口，
            并为缺少凭据的座位填写对应的 API
            Key。无法确认旧接口时，请关闭此窗口。
            此操作不会改变当前牌桌的新局配置。
          </DialogDescription>
        </DialogHeader>
        {resumePrompt?.seats.map(
          (s, i) =>
            required(i) && (
              <div key={s.profile.id} className="space-y-2">
                <p>
                  {s.profile.name} · {s.connection.label} · {s.profile.model}
                </p>
                <Input
                  aria-label={s.profile.name + ' 接口地址'}
                  value={
                    s.connection.kind === 'openai-compatible'
                      ? s.connection.baseUrl || ''
                      : providerBaseUrl(s.connection)
                  }
                  disabled={
                    (!!resumePrompt.game.seats[i].connection &&
                      !!credentialEndpoint({
                        ...resumePrompt.game.seats[i].connection,
                        apiKey: '',
                      })) ||
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
                              connection: editProviderConnection(v.connection, {
                                ...v.connection,
                                baseUrl: e.target.value,
                              }),
                            }
                          : v,
                      ),
                    })
                  }
                />
                <Input
                  type="password"
                  disabled={!credentialEndpoint(s.connection)}
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
            ),
        )}
        {resumeError && <p role="alert">{resumeError}</p>}
        <Button
          disabled={running}
          onClick={() => {
            if (!resumePrompt) return;
            if (
              needsResumeInput(
                resumePrompt.seats.filter((_, i) => required(i)),
                resumePrompt.game.mode,
              )
            ) {
              setResumeError(
                '请为需要连接的座位确认 HTTPS 接口并填写对应的 API Key',
              );
              return;
            }
            const target = resumePrompt;
            setResumePrompt(null);
            target.confirm(target.seats);
          }}
        >
          {resumePrompt?.summary
            ? '确认连接并补生成总结'
            : '保存连接并继续旧局'}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
