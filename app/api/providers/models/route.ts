import { listModels } from '../../../../lib/agents/model.ts';
import type { ProviderConnection } from '../../../../lib/agents/types.ts';
export async function POST(request: Request) {
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin)
    return Response.json({ error: '跨站请求被拒绝' }, { status: 403 });
  try {
    const body = (await request.json()) as { connection?: ProviderConnection };
    if (!body.connection)
      return Response.json(
        { error: '请先填写供应商与 API Key' },
        { status: 400 },
      );
    return Response.json(
      { models: await listModels(body.connection, request.signal) },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (e) {
    return Response.json(
      {
        error:
          e instanceof Error &&
          !['TypeError', 'TimeoutError', 'AbortError', 'SyntaxError'].includes(
            e.name,
          )
            ? e.message
            : '无法获取模型列表，请检查地址和网络，或手动填写模型 ID',
      },
      { status: 400 },
    );
  }
}
