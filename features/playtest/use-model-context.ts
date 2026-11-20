'use client';
import { useEffect } from 'react';
import type { Seat } from '@/lib/playtest/types';

// Expose configuration only; never expose API keys or private game state.
export function useModelContext(
  ruleVersion: string,
  seats: Seat[],
  running: boolean,
) {
  useEffect(() => {
    const context = (
      document as Document & {
        modelContext?: {
          registerTool?: (
            tool: unknown,
            options: { signal: AbortSignal },
          ) => unknown;
        };
      }
    ).modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    void Promise.resolve(
      context.registerTool(
        {
          name: 'read_playtest_configuration',
          description:
            '读取规则版本、启用座位数量与对局状态，不返回密钥或隐藏牌。',
          inputSchema: {
            type: 'object',
            properties: {},
            additionalProperties: false,
          },
          annotations: { readOnlyHint: true },
          execute: () => ({
            ruleVersion: ruleVersion,
            seats: seats.filter((s) => s.enabled).length,
            running,
          }),
        },
        { signal: lifecycle.signal },
      ),
    ).catch(() => undefined);
    return () => lifecycle.abort();
  }, [ruleVersion, seats, running]);
}
