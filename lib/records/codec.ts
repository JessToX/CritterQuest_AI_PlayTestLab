import { gunzipSync, gzipSync, strFromU8, strToU8 } from 'fflate';
export function packRecord(value: unknown): unknown {
  const json = JSON.stringify(value);
  if (json.length < 200000) return value;
  const bytes = gzipSync(strToU8(json));
  let binary = '';
  for (let i = 0; i < bytes.length; i += 8192)
    binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return { recordEncoding: 'gzip-base64-v1', data: btoa(binary) };
}
export function unpackRecord(value: unknown): unknown {
  if (
    !value ||
    typeof value !== 'object' ||
    (value as { recordEncoding?: string }).recordEncoding !== 'gzip-base64-v1'
  )
    return value;
  const data = (value as { data: unknown }).data;
  if (typeof data !== 'string' || data.length > 16000000)
    throw new Error('压缩记录格式或大小无效');
  const bytes = Uint8Array.from(atob(data), (c) => c.charCodeAt(0));
  // gzip trailer records the decompressed size; reject before allocation.
  if (
    bytes.length < 18 ||
    new DataView(bytes.buffer).getUint32(bytes.length - 4, true) > 64000000
  )
    throw new Error('解压记录超过 64 MB 上限');
  return JSON.parse(strFromU8(gunzipSync(bytes)));
}
