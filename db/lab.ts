import { env } from 'cloudflare:workers';
import { packRecord } from '../lib/records/codec.ts';
import {
  readRecordPage,
  readStoredRecord,
  type ChunkManifest,
} from './lab-reader.ts';
export { LabRecordReadError } from './lab-reader.ts';

export async function records(kind: string, offset = 0) {
  return readRecordPage(env.DB, kind, offset);
}
export async function putRecord(id: string, kind: string, value: unknown) {
  const encoded = JSON.stringify(packRecord(value));
  if (encoded.length <= 300000) {
    await env.DB.batch([
      env.DB.prepare(
        'INSERT INTO lab_records (id,kind,value,updated_at) VALUES (?,?,?,?) ON CONFLICT(id) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at',
      ).bind(id, kind, encoded, Date.now()),
      env.DB.prepare('DELETE FROM lab_record_chunks WHERE record_id = ?').bind(
        id,
      ),
    ]);
    return;
  }
  const revision = crypto.randomUUID(),
    parts: string[] = [];
  for (let i = 0; i < encoded.length; i += 200000)
    parts.push(encoded.slice(i, i + 200000));
  const manifest: ChunkManifest = {
    recordChunks: 1,
    revision,
    count: parts.length,
    status: (value as { status?: string }).status,
  };
  await env.DB.batch([
    ...parts.map((part, i) =>
      env.DB.prepare(
        'INSERT INTO lab_record_chunks(record_id,revision,part,value) VALUES(?,?,?,?)',
      ).bind(id, revision, i, part),
    ),
    env.DB.prepare(
      'INSERT INTO lab_records (id,kind,value,updated_at) VALUES (?,?,?,?) ON CONFLICT(id) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at',
    ).bind(id, kind, JSON.stringify(manifest), Date.now()),
    env.DB.prepare(
      'DELETE FROM lab_record_chunks WHERE record_id = ? AND revision != ?',
    ).bind(id, revision),
  ]);
}
export async function deleteRecord(
  id: string,
  kind: string,
  check?: (value: unknown) => void,
) {
  const record = await readStoredRecord(env.DB, id, kind);
  if (!record) return;
  check?.(record.value);
  if (
    kind === 'game' &&
    (record.value as { status?: string })?.status === 'running'
  )
    throw new Error('请先暂停或终止对局再删除');
  const [removed] = await env.DB.batch([
    env.DB.prepare(
      'DELETE FROM lab_records WHERE id = ? AND kind = ? AND value = ?',
    ).bind(id, kind, record.raw),
    env.DB.prepare(
      'DELETE FROM lab_record_chunks WHERE record_id = ? AND NOT EXISTS (SELECT 1 FROM lab_records WHERE id = ?)',
    ).bind(id, id),
  ]);
  if (!removed.meta.changes) throw new Error('记录已变更，请刷新后重试');
}
