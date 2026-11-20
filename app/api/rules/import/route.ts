import { UNSUPPORTED_RELEASE_VERSION } from '@/lib/game/registry';

export function POST() {
  return Response.json({ error: UNSUPPORTED_RELEASE_VERSION }, { status: 422 });
}
