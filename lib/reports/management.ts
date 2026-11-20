import { enrichMemory } from '../memory/management.ts';
import type { MemoryEntry } from '../memory/types.ts';
import type { GameRecord } from '../playtest/types.ts';

export interface ReportDeletionResult {
  deletedIds: string[];
  failures: Array<{ id: string; message: string }>;
}

export async function deleteSelectedReports(
  selected: GameRecord[],
  {
    games,
    memories,
    onDeleted,
    saveMemory,
    removeGame,
  }: {
    games: GameRecord[];
    memories: MemoryEntry[];
    onDeleted: (game: GameRecord) => void;
    saveMemory: (entry: MemoryEntry) => Promise<void>;
    removeGame: (id: string) => Promise<void>;
  },
): Promise<ReportDeletionResult> {
  const result: ReportDeletionResult = { deletedIds: [], failures: [] };
  const savedMemories = new Set<string>();
  for (const game of new Map(selected.map((g) => [g.id, g])).values()) {
    try {
      if (game.status === 'running')
        throw new Error('请先暂停或终止对局再删除');
      // Preserve author snapshots before removing any source games. Shared
      // memories only need to be saved once per batch, and are never deleted.
      for (const memory of memories) {
        if (
          memory.sourceGameIds.includes(game.id) &&
          !savedMemories.has(memory.id)
        ) {
          await saveMemory(enrichMemory(memory, games));
          savedMemories.add(memory.id);
        }
      }
      await removeGame(game.id);
    } catch (error) {
      result.failures.push({
        id: game.id,
        message: error instanceof Error ? error.message : '删除失败，请重试',
      });
      continue;
    }
    result.deletedIds.push(game.id);
    onDeleted(game);
  }
  return result;
}
