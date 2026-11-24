import { rejectCrossOrigin } from '../../request-origin.ts';
import {
  ModelFailure,
  failureDetails,
} from '../../../../lib/agents/diagnostics.ts';
import { requestModel } from '../../../../lib/agents/model.ts';
import { protocols } from '../../../../lib/agents/protocols.ts';
import type {
  ModelSettings,
  ProviderConnection,
} from '../../../../lib/agents/types.ts';
export async function POST(request: Request) {
  try {
    const rejection = rejectCrossOrigin(request);
    if (rejection) return rejection;
    const { connection, model, input, task, settings } =
      (await request.json()) as {
        connection: ProviderConnection;
        model: string;
        input: unknown;
        task: string;
        settings?: ModelSettings;
      };
    if (!protocols[task])
      return Response.json({ error: '任务类型无效' }, { status: 400 });
    const result = await requestModel(
      connection,
      model,
      protocols[task],
      input,
      request.signal,
      { task, settings },
    );
    return Response.json(result, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    return Response.json(
      {
        error: e instanceof Error ? e.message : '模型调用失败',
        details: e instanceof ModelFailure ? e.details : failureDetails(e),
      },
      { status: 502 },
    );
  }
}
