import { failureDetails } from '../../../../lib/agents/diagnostics.ts';
import { PROVIDER_PRESETS } from '../../../../lib/agents/presets.ts';
import { requestDecision } from '../../../../lib/agents/providers.ts';
import {
  applyAction,
  createGame,
  legalActions,
  startTurn,
  visibleStateFor,
} from '../../../../lib/game/engine.ts';

const deepseek = PROVIDER_PRESETS.find(
  (provider) => provider.id === 'deepseek',
)!;

// The one-shot budget belongs to the local server, so tabs and refreshes share it.
export function createSingleMoveHandler() {
  let used = false;
  return async (request: Request) => {
    const url = new URL(request.url);
    if (
      request.headers.get('origin') !== url.origin ||
      !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
    )
      return Response.json({ code: 'origin' }, { status: 403 });
    const body = (await request.json().catch(() => null)) as {
      apiKey?: unknown;
      model?: unknown;
    } | null;
    if (
      typeof body?.apiKey !== 'string' ||
      !body.apiKey.trim() ||
      body.apiKey.length > 2048 ||
      typeof body.model !== 'string' ||
      !/^[a-z0-9][a-z0-9._:-]{0,119}$/i.test(body.model)
    )
      return Response.json({ code: 'configuration' }, { status: 400 });
    if (used) return Response.json({ code: 'used' }, { status: 409 });
    used = true;

    try {
      const state = startTurn(createGame(['样例牌手', '合成对手'], 71));
      const actions = legalActions(state)
        .filter(
          ({ action }) =>
            action.type === 'buy' && action.recipientId === 'player-1',
        )
        .map((action, index) => ({ ...action, id: String(index + 1) }));
      const decision = await requestDecision(
        { ...deepseek, apiKey: body.apiKey.trim() },
        {
          agent: {
            id: 'sample',
            name: '样例牌手',
            providerId: deepseek.id,
            model: body.model,
            customInstructions: '',
            memoryMode: 'disabled',
            modelSettings: {
              stream: false,
              thinking: 'disabled',
              decisionTimeoutSeconds: 45,
              maxOutputTokens: 512,
            },
          },
          state: visibleStateFor(state, 'player-1'),
          legalActions: actions,
          rulebook:
            'V7.1 购买阶段：从给出的市场动作中选择一次为自己购买的动作，只返回该动作的 ID。',
          memories: [],
          publicChat: [],
        },
        request.signal,
      );
      // The engine checks legality again and applies the action to the disposable state.
      applyAction(state, decision.action);
      const accepted = actions.find(
        (action) => action.action === decision.action,
      )!;
      return Response.json({ code: 'accepted', action: accepted.label });
    } catch (error) {
      const { code, status } = failureDetails(error);
      const category =
        status === 401 || status === 403
          ? 'authentication'
          : status === 402
            ? 'balance'
            : status === 429
              ? 'rate_limit'
              : code;
      return Response.json({ code: category }, { status: 502 });
    }
  };
}
