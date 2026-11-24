/** Ordinary API routes also accept clients that omit Origin, such as the local CLI. */
export function rejectCrossOrigin(request: Request): Response | undefined {
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin)
    return Response.json({ error: '跨站请求被拒绝' }, { status: 403 });
}
