import { rejectCrossOrigin } from '../../request-origin.ts';
import { failureDetails } from '../../../../lib/agents/diagnostics.ts';
import { requestModel } from '../../../../lib/agents/model.ts';
import type {
  ModelSettings,
  ProviderConnection,
} from '../../../../lib/agents/types.ts';

export async function POST(request: Request) {
  try {
    const rejection = rejectCrossOrigin(request);
    if (rejection) return rejection;
    const body = (await request.json()) as {
      connection?: ProviderConnection;
      model?: string;
      settings?: ModelSettings;
    };
    const connection = body.connection;
    if (!connection?.apiKey || !body.model)
      return Response.json(
        { error: '请输入 API Key 和模型名称。' },
        { status: 400 },
      );
    const result = await requestModel(
      connection,
      body.model,
      'Return JSON {ok:true}.',
      {},
      request.signal,
      { task: 'test', settings: body.settings },
    );
    if (result.data.ok !== true) throw new Error('模型响应无效');
    return Response.json({
      ok: true,
      provider: connection.label,
      model: body.model,
      latencyMs: result.latencyMs,
      usage: result.usage,
      note: '真实模型连接成功。',
    });
  } catch (error) {
    const details = failureDetails(error);
    return Response.json({ error: details.message, details }, { status: 502 });
  }
}
