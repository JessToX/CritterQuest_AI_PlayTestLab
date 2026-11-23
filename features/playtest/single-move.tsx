'use client';
import { Button } from '@/components/ui/button';
import { sameCredentialEndpoint } from '@/lib/agents/provider-endpoint';
import { PROVIDER_PRESETS } from '@/lib/agents/presets';
import type { Seat } from '@/lib/playtest/types';
import { useRef, useState } from 'react';

const deepseek = PROVIDER_PRESETS.find(
  (provider) => provider.id === 'deepseek',
)!;
const failureText: Record<string, string> = {
  used: '本机服务的单步验收次数已用完。',
  configuration: '已保存的模型配置不可用。',
  authentication: 'DeepSeek 拒绝了凭据或访问权限。',
  balance: 'DeepSeek 返回余额不足。',
  rate_limit: 'DeepSeek 返回请求频率限制。',
  timeout: '等待 DeepSeek 超时。',
  network: '连接 DeepSeek 失败。',
  invalid_action: 'DeepSeek 返回了不在合法动作列表中的动作。',
  invalid_json: 'DeepSeek 未返回有效的动作格式。',
  empty_response: 'DeepSeek 返回了空响应。',
  truncated: 'DeepSeek 的响应被截断。',
};

export function SingleMove({ seats }: { seats: Seat[] }) {
  const used = useRef(false);
  const [result, setResult] = useState('');
  const index = seats.findIndex(
    ({ profile, connection }) =>
      sameCredentialEndpoint(connection, { ...deepseek, apiKey: '' }) &&
      connection.apiKey.trim() &&
      profile.model.trim(),
  );

  async function run() {
    if (used.current || index < 0) return;
    used.current = true;
    setResult('等待 DeepSeek 返回一次动作…');
    const seat = seats[index];
    try {
      const response = await fetch('/api/agents/single-move', {
        method: 'POST',
        redirect: 'error',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: seat.profile.model.trim(),
          apiKey: seat.connection.apiKey,
        }),
      });
      const data = (await response.json()) as { code: string; action?: string };
      if (
        response.ok &&
        data.code === 'accepted' &&
        typeof data.action === 'string'
      ) {
        setResult(`DeepSeek 动作已接受：${data.action}`);
      } else {
        setResult(
          Object.hasOwn(failureText, data.code)
            ? failureText[data.code]
            : '单步验收失败，未重试。',
        );
      }
    } catch {
      setResult('未收到本机服务的确认，未重试。');
    }
  }

  return (
    <section className="cq-notice" aria-label="DeepSeek 单步验收">
      <div>
        <p>
          使用固定 V7.1 样例。点击后发起一次真实 DeepSeek 请求，可能计费。
          每次本机服务启动后只允许一次。
        </p>
        <Button type="button" onClick={run} disabled={index < 0 || !!result}>
          试出一张牌{index >= 0 ? `（座位 ${index + 1} · DeepSeek）` : ''}
        </Button>
        <output>
          {result || (index < 0 ? '需要已保存的 DeepSeek 模型配置。' : '')}
        </output>
      </div>
    </section>
  );
}
