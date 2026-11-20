import { unpackRecord } from '../lib/records/codec.ts';

export interface ChunkManifest {
  recordChunks: 1;
  revision: string;
  count: number;
  status?: string;
}
type StoredRow = {
  id: string;
  raw: string;
  part: number | null;
  chunk: string | null;
};

export class LabRecordReadError extends Error {}

function parseStored(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    throw new LabRecordReadError('本地记录已损坏，请保留备份并重试');
  }
}

function unpackStored(value: unknown) {
  try {
    return unpackRecord(value);
  } catch {
    throw new LabRecordReadError('本地记录已损坏，请保留备份并重试');
  }
}

function decodeRows(rows: StoredRow[]) {
  const byRecord = new Map<string, StoredRow[]>();
  for (const row of rows) {
    const current = byRecord.get(row.id);
    if (current) current.push(row);
    else byRecord.set(row.id, [row]);
  }
  return [...byRecord.values()].map((parts) => {
    const raw = parts[0].raw;
    const value = parseStored(raw);
    const manifest = value as ChunkManifest | null;
    if (manifest?.recordChunks !== 1)
      return { raw, value: unpackStored(value) };
    if (
      !Number.isSafeInteger(manifest.count) ||
      manifest.count < 1 ||
      parts.length !== manifest.count ||
      parts.some((row, index) => row.part !== index || row.chunk === null)
    )
      throw new LabRecordReadError('对局记录分片不完整，请保留备份并重试');
    return {
      raw,
      value: unpackStored(parseStored(parts.map((row) => row.chunk).join(''))),
    };
  });
}

// Select the page first so fragments neither consume page slots nor cross revisions.
function withChunks(selection: string) {
  return `WITH selected AS (${selection})
    SELECT selected.id, selected.value AS raw, chunks.part, chunks.value AS chunk
    FROM selected LEFT JOIN lab_record_chunks AS chunks
      ON chunks.record_id = selected.id
      AND chunks.revision = CASE WHEN json_valid(selected.value) THEN
        CASE WHEN json_extract(selected.value, '$.recordChunks') = 1
          THEN json_extract(selected.value, '$.revision')
        END
      END
    ORDER BY selected.updated_at DESC, selected.id DESC, chunks.part`;
}

export async function readRecordPage(
  db: D1Database,
  kind: string,
  offset: number,
) {
  const result = await db
    .prepare(
      withChunks(
        'SELECT id, value, updated_at FROM lab_records WHERE kind = ? ORDER BY updated_at DESC, id DESC LIMIT 20 OFFSET ?',
      ),
    )
    .bind(kind, offset)
    .all<StoredRow>();
  return decodeRows(result.results).map(({ value }) => value);
}
export async function readStoredRecord(
  db: D1Database,
  id: string,
  kind: string,
) {
  const result = await db
    .prepare(
      withChunks(
        'SELECT id, value, updated_at FROM lab_records WHERE id = ? AND kind = ?',
      ),
    )
    .bind(id, kind)
    .all<StoredRow>();
  return decodeRows(result.results)[0];
}
