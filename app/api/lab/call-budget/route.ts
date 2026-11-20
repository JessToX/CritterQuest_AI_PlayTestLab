import { env } from 'cloudflare:workers';

export async function POST(request: Request) {
  if (request.headers.get('origin') !== new URL(request.url).origin)
    return Response.json({ code: 'origin' }, { status: 403 });
  const body = (await request.json().catch(() => null)) as {
    gameId?: string;
    limit?: number;
    previous?: number;
  } | null;
  const { gameId, limit, previous } = body || {};
  if (
    typeof gameId !== 'string' ||
    !/^[a-f0-9-]{36}$/.test(gameId) ||
    typeof limit !== 'number' ||
    !Number.isInteger(limit) ||
    limit < 1 ||
    limit > 10000 ||
    typeof previous !== 'number' ||
    !Number.isSafeInteger(previous) ||
    previous < 0
  )
    return Response.json({ code: 'configuration' }, { status: 400 });
  if (previous >= limit)
    return Response.json({ code: 'exhausted' }, { status: 409 });

  // Commit one slot before dispatch, even if the client disconnects before reading it.
  // The first reservation fixes the cap; stale tabs cannot replace the saved counter.
  const reservation = await env.DB.prepare(
    `INSERT INTO lab_call_budgets(game_id, call_limit, used) VALUES (?, ?, ?)
     ON CONFLICT(game_id) DO UPDATE SET used = used + 1
     WHERE used < call_limit AND used < ?
     RETURNING used`,
  )
    .bind(gameId, limit, previous + 1, limit)
    .first<{ used: number }>();

  return reservation
    ? Response.json({ used: reservation.used })
    : Response.json({ code: 'exhausted' }, { status: 409 });
}
