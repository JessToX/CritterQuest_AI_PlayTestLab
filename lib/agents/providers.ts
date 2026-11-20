import { ModelFailure } from './diagnostics.ts';
import { requestModel } from './model.ts';
import { buildDecisionInput, NEUTRAL_GAME_PROTOCOL } from './prompt.ts';
import type {
  ActionDecision,
  DecisionContext,
  ProviderConnection,
} from './types.ts';
export async function requestDecision(
  connection: ProviderConnection,
  context: DecisionContext,
  signal?: AbortSignal,
): Promise<ActionDecision> {
  const result = await requestModel(
    connection,
    context.agent.model,
    NEUTRAL_GAME_PROTOCOL,
    buildDecisionInput(context),
    signal,
    { task: 'decision', settings: context.agent.modelSettings },
  );
  const selected = context.legalActions.find(
    (a) => a.id === result.data.actionId,
  );
  if (!selected)
    throw new ModelFailure({
      code: 'invalid_action',
      message: '模型返回不合法动作',
      retryable: true,
    });
  return {
    action: selected.action,
    publicMessage: '',
    reason:
      typeof result.data.reason === 'string'
        ? result.data.reason.slice(0, 800)
        : '',
    providerRequestId: result.requestId,
    usage: result.usage,
  };
}
