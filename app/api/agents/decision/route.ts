import { rejectCrossOrigin } from '../../request-origin.ts';
import { abortableDelay, failureDetails } from '@/lib/agents/diagnostics';
import { requestDecision } from '@/lib/agents/providers';
import type { DecisionContext, ProviderConnection } from '@/lib/agents/types';

export async function POST(request: Request) {
  try {
    const rejection = rejectCrossOrigin(request);
    if (rejection) return rejection;
    const body = (await request.json()) as {
      connection?: ProviderConnection;
      context?: DecisionContext;
    };
    if (!body.connection?.apiKey || !body.context?.agent?.model) {
      return Response.json(
        { error: 'Missing provider API key, model, or decision context.' },
        { status: 400 },
      );
    }
    if (body.context.legalActions.length === 0) {
      return Response.json(
        { error: 'No legal actions are available.' },
        { status: 400 },
      );
    }

    let lastError: unknown;
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      try {
        const decision = await requestDecision(
          body.connection,
          body.context,
          request.signal,
        );
        return Response.json({ decision, attempt });
      } catch (error) {
        lastError = error;
        if (request.signal.aborted || !failureDetails(error).retryable) break;
        if (attempt < 2) await abortableDelay(1000, request.signal);
      }
    }
    throw lastError;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unknown provider error.';
    return Response.json(
      { error: message, details: failureDetails(error) },
      { status: 502 },
    );
  }
}
