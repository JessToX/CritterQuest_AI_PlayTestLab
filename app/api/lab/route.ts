import { rejectCrossOrigin } from '../request-origin.ts';
import { deleteRecord, LabRecordReadError, putRecord, records } from '@/db/lab';
import { packRecord, unpackRecord } from '@/lib/records/codec';
import {
  RECORD_PAGE_SIZE,
  isRecordKind,
  isDeletableRecordKind,
} from '@/lib/records/types';
import {
  OFFICIAL_RULE_ID,
  UNSUPPORTED_RELEASE_VERSION,
} from '@/lib/game/registry';
import { isOfficialGame, isOfficialRule } from '@/lib/rules/scope';

function isSupportedRecord(kind: string, value: unknown) {
  if (kind === 'game') return isOfficialGame(value);
  if (kind === 'rule') return isOfficialRule(value);
  if (kind === 'memory')
    return (
      (value as { ruleVersion?: string } | null)?.ruleVersion ===
      OFFICIAL_RULE_ID
    );
  return true;
}
export async function GET(request: Request) {
  try {
    const kind = new URL(request.url).searchParams.get('kind') || 'game';
    const offset = Number(new URL(request.url).searchParams.get('offset') || 0);
    if (!Number.isSafeInteger(offset) || offset < 0)
      return Response.json({ error: '无效页码' }, { status: 400 });
    if (!isRecordKind(kind))
      return Response.json({ error: '无效类型' }, { status: 400 });
    const page = await records(kind, offset);
    const supported = page.filter((value) => isSupportedRecord(kind, value));
    return Response.json(
      {
        records: supported.map(packRecord),
        hasMore: page.length === RECORD_PAGE_SIZE,
        unsupported: page.length - supported.length,
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof LabRecordReadError
            ? error.message
            : '本地数据库不可用，请运行数据库迁移',
      },
      { status: 503 },
    );
  }
}
function sanitized(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sanitized);
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => !/api.?key|authorization|secret/i.test(key))
        .map(([key, v]) => [key, sanitized(v)]),
    );
  return value;
}
export async function POST(request: Request) {
  try {
    const rejection = rejectCrossOrigin(request);
    if (rejection) return rejection;
    const body = await request.text();
    if (body.length > 16000000)
      return Response.json({ error: '记录过大' }, { status: 413 });
    const { id, kind, value } = JSON.parse(body);
    if (
      typeof id !== 'string' ||
      id.length > 180 ||
      !isRecordKind(kind) ||
      !value
    )
      return Response.json({ error: '无效记录' }, { status: 400 });
    const unpacked = unpackRecord(value);
    if (!isSupportedRecord(kind, unpacked))
      return Response.json(
        { error: UNSUPPORTED_RELEASE_VERSION },
        { status: 422 },
      );
    await putRecord(id, kind, sanitized(unpacked));
    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: '记录保存失败' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const rejection = rejectCrossOrigin(request);
  if (rejection) return rejection;
  try {
    const { id, kind } = (await request.json()) as { id: string; kind: string };
    if (
      typeof id !== 'string' ||
      !id ||
      id.length > 180 ||
      !isDeletableRecordKind(kind)
    )
      return Response.json({ error: '无效删除请求' }, { status: 400 });
    await deleteRecord(id, kind, (value) => {
      if (!isSupportedRecord(kind, value))
        throw new Error(UNSUPPORTED_RELEASE_VERSION);
    });
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : '删除失败' },
      { status: 400 },
    );
  }
}
