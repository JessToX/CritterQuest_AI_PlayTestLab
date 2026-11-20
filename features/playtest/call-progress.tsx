'use client';
import { useEffect, useState } from 'react';
import { taskNames } from '@/lib/game/labels';
import type { GameRecord } from '@/lib/playtest/types';

export function CallProgress({ game }: { game: GameRecord }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const wait = game.retryWait;
  if (wait)
    return (
      <output className="cq-call-progress">
        {wait.name} · {wait.model} · {taskNames[wait.task] || wait.task}：
        {wait.reason}，还需 {Math.max(0, Math.ceil((wait.until - now) / 1000))}{' '}
        秒后开始第 {wait.nextAttempt} 次尝试。当前没有发起新请求，可随时暂停。
      </output>
    );
  const p = game.inFlight;
  return p ? (
    <output className="cq-call-progress">
      正在等待 {p.name} · {p.model} · {taskNames[p.task] || p.task} · 已等待{' '}
      {Math.max(0, Math.floor((now - p.startedAt) / 1000))} 秒 / 上限{' '}
      {p.timeoutMs / 1000} 秒 · 第 {p.attempt} 次尝试
    </output>
  ) : null;
}
