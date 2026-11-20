import type { GameRecord } from '../playtest/types.ts';
import type { MemoryEntry } from './types.ts';
export function enrichMemory(m: MemoryEntry, games: GameRecord[]): MemoryEntry {
  if (m.author) return m;
  const parts = m.agentId.split('|');
  const valid = parts.length === 6;
  const seatId = valid ? parts[0] : '';
  const source = games.find((g) => m.sourceGameIds.includes(g.id));
  const seat = source?.seats.find((s) => s.id === seatId);
  return {
    ...m,
    mode: m.mode || (valid ? parts[5] : undefined),
    author: {
      seatId: seatId || '历史信息缺失',
      name: seat?.name || '历史信息缺失',
      provider: seat?.provider || '历史信息缺失',
      model: valid ? parts[3] : '历史信息缺失',
    },
  };
}

export async function deleteSelectedMemories(
  entries: MemoryEntry[],
  remove: (entry: MemoryEntry) => Promise<void>,
) {
  const failures: string[] = [];
  let deleted = 0;
  for (const entry of entries) {
    try {
      await remove(entry);
      deleted++;
    } catch {
      failures.push(entry.id);
    }
  }
  return { deleted, failures };
}
