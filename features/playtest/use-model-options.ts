import { credentialEndpoint } from '@/lib/agents/provider-endpoint';
import type { ProviderConnection } from '@/lib/agents/types';
import { useEffect, useState } from 'react';

export function useModelOptions(
  modelConnection: ProviderConnection | null,
  edit: number | null,
) {
  const [modelsRefresh, setModelsRefresh] = useState(0);
  const [result, setResult] = useState<{
    connection: ProviderConnection;
    seat: number | null;
    refresh: number;
    options: string[];
    loading: boolean;
    message: string;
  }>();
  useEffect(() => {
    if (!modelConnection?.apiKey.trim() || !credentialEndpoint(modelConnection))
      return;

    const abort = new AbortController();
    const publish = (
      message: string,
      options: string[] = [],
      loading = false,
    ) => {
      if (!abort.signal.aborted)
        setResult({
          connection: modelConnection,
          seat: edit,
          refresh: modelsRefresh,
          options,
          loading,
          message,
        });
    };
    const timer = setTimeout(async () => {
      publish('正在获取可用模型…', [], true);
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
        publish(
          '已获取模型，请从下拉列表选择。列表权限不代表模型一定支持本程序，请再测试连接。',
          body.models,
        );
      } catch (e) {
        publish(e instanceof Error ? e.message : '获取失败，可手动填写模型');
      }
    }, 700);
    return () => {
      clearTimeout(timer);
      abort.abort();
    };
  }, [modelsRefresh, edit, modelConnection]);

  const current =
    result?.connection === modelConnection &&
    result.seat === edit &&
    result.refresh === modelsRefresh
      ? result
      : undefined;
  return {
    modelOptions: current?.options ?? [],
    modelsLoading: current?.loading ?? false,
    setModelsRefresh,
    modelsMessage:
      current?.message ??
      (modelConnection && !credentialEndpoint(modelConnection)
        ? '请先填写有效的 HTTPS API 地址。'
        : '填入 API Key 后自动获取模型，也可手动填写。'),
  };
}
