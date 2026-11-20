import { packRecord, unpackRecord } from '../records/codec.ts';
import type {
  DeletableRecordKind,
  RecordKind,
  RecordTypes,
} from '../records/types.ts';
export async function loadRecords<K extends RecordKind>(kind: K) {
  const records: RecordTypes[K][] = [];
  let unsupported = 0;
  for (let offset = 0; ; offset += 20) {
    const response = await fetch('/api/lab?kind=' + kind + '&offset=' + offset);
    const body = (await response.json()) as {
      error?: string;
      records: unknown[];
      hasMore: boolean;
      unsupported?: number;
    };
    if (!response.ok) throw new Error(body.error);
    records.push(
      ...body.records.map((value) => unpackRecord(value) as RecordTypes[K]),
    );
    unsupported += body.unsupported ?? 0;
    if (!body.hasMore) return { records, unsupported };
  }
}
export async function load<K extends RecordKind>(kind: K) {
  return (await loadRecords(kind)).records;
}

export async function save<K extends RecordKind>(
  id: string,
  kind: K,
  value: RecordTypes[K],
) {
  const response = await fetch('/api/lab', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, kind, value: packRecord(value) }),
  });
  const body = (await response.json()) as { error?: string };
  if (!response.ok) throw new Error(body.error);
}
export async function removeRecord(id: string, kind: DeletableRecordKind) {
  const response = await fetch('/api/lab', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, kind }),
  });
  const body = (await response.json()) as { error?: string };
  if (!response.ok) throw new Error(body.error || '删除失败');
}
