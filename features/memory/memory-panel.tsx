'use client';
import { TabsContent } from '@/components/ui/tabs';
import { MemoryManager } from '@/features/memory/memory-manager';
import type { MemoryEntry } from '@/lib/memory/types';
import type { GameRecord, Seat } from '@/lib/playtest/types';

interface Props {
  memories: MemoryEntry[];
  games: GameRecord[];
  seats: Seat[];
  running: boolean;
  stopping: boolean;
  persistMemory: (entry: MemoryEntry) => Promise<void>;
  deleteMemory: (entry: MemoryEntry) => Promise<void>;
}
export function MemoryPanel({
  memories,
  games,
  seats,
  running,
  stopping,
  persistMemory,
  deleteMemory,
}: Props) {
  return (
    <TabsContent value="memory" className="space-y-4 mt-5">
      <MemoryManager
        entries={memories}
        games={games}
        seats={seats}
        running={running || stopping}
        onSave={persistMemory}
        onDelete={deleteMemory}
      />
    </TabsContent>
  );
}
