import type { ProviderConnection } from '@/lib/agents/types';
import { useEffect, useState } from 'react';
export function useModelOptions(
  modelConnection: ProviderConnection | null,
  edit: number | null,
) {
  const [modelOptions, setModelOptions] = useState<string[]>([]);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [modelsRefresh, setModelsRefresh] = useState(0);
  const [modelsMessage, setModelsMessage] = useState('');
  useEffect(() => {
    const abort = new AbortController();
    const timer = setTimeout(async () => {
      setModelOptions([]);
      setModelsLoading(false);
      setModelsMessage('填入 API Key 后自动获取模型，也可手动填写。');
      if (!modelConnection?.apiKey.trim()) return;
      if (
        modelConnection.kind === 'openai-compatible' &&
        !modelConnection.baseUrl?.trim()
      ) {
        setModelsMessage('请填写 HTTPS Base URL');
        return;
      }
      setModelsLoading(true);
      setModelsMessage('正在获取可用模型…');
      try {
        const response = await fetch('/api/providers/models', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ connection: modelConnection }),
          signal: abort.signal,
        });
        const body = (await response.json()) as {
          models?: string[];
          error?: string;
        };
        if (!response.ok) throw new Error(body.error);
        if (!abort.signal.aborted) {
          setModelOptions(body.models || []);
          setModelsMessage(
            '已获取模型，请从下拉列表选择。列表权限不代表模型一定支持本程序，请再测试连接。',
          );
        }
      } catch (e) {
        if (!abort.signal.aborted)
          setModelsMessage(
            e instanceof Error ? e.message : '获取失败，可手动填写模型',
          );
      } finally {
        if (!abort.signal.aborted) setModelsLoading(false);
      }
    }, 700);
    return () => {
      clearTimeout(timer);
      abort.abort();
    };
  }, [modelsRefresh, edit, modelConnection]);
  return { modelOptions, modelsLoading, setModelsRefresh, modelsMessage };
}
