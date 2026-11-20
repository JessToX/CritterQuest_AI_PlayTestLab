import type { CallModel } from './types.ts';
import type { LegalAction } from '../game/types.ts';
import type { PublicMarketState } from '../game/market-types.ts';
import { marketSimulationAction } from './market-simulation.ts';
export const simulationCall: CallModel = async (_seat, task, input) => {
  const value = input as {
    legalActions?: Array<{ id: string }>;
    visibleState?: {
      turn: number;
      phase: string;
      self?: { id: string };
      marketGame?: PublicMarketState;
    };
  };
  let data: Record<string, unknown>;
  if (task === 'decision') {
    const actions = value.legalActions!;
    if (!value.visibleState?.marketGame || !value.visibleState.self)
      throw new Error('模拟需要正式 V7.1 市场状态');
    data = {
      actionId: marketSimulationAction(
        actions as LegalAction[],
        value.visibleState.marketGame,
        value.visibleState.self.id,
      ).id,
      publicMessage: '',
      reason: '确定性模拟动作，用于检验流程，不代表模型水平',
    };
  } else if (task === 'chat') data = { speak: true, message: '模拟回应' };
  else
    data = {
      reflection:
        '模拟反思：本次仅验证规则执行、消息与记忆保存，不用于平衡性结论。',
    };
  return { data, latencyMs: 0, usage: { inputTokens: 0, outputTokens: 0 } };
};
