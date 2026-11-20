import { removeRecord, save } from '@/lib/client/records';
import type { MemoryEntry } from '@/lib/memory/types';
import type { GameRecord } from '@/lib/playtest/types';
import { deleteSelectedReports } from '@/lib/reports/management';
import { useRef, useState } from 'react';
interface Options {
  games: GameRecord[];
  memories: MemoryEntry[];
  replaceGame: (game: GameRecord) => void;
  removeGameFromState: (game: GameRecord) => void;
}
export function useReportManagement({
  games,
  memories,
  replaceGame,
  removeGameFromState,
}: Options) {
  const [deleting, setDeleting] = useState(false);
  const deletionInProgress = useRef(false);
  const saveReport = async (changed: GameRecord) => {
    await save(changed.id, 'game', changed);
    replaceGame(changed);
  };
  const deleteReports = async (selected: GameRecord[]) => {
    if (deletionInProgress.current) throw new Error('正在删除报告，请稍候');
    deletionInProgress.current = true;
    setDeleting(true);
    try {
      return await deleteSelectedReports(selected, {
        games,
        memories,
        onDeleted: removeGameFromState,
        saveMemory: (entry) => save(entry.id, 'memory', entry),
        removeGame: (id) => removeRecord(id, 'game'),
      });
    } finally {
      deletionInProgress.current = false;
      setDeleting(false);
    }
  };
  const deleteReport = async (deleted: GameRecord) => {
    const result = await deleteReports([deleted]);
    if (result.failures.length) throw new Error(result.failures[0].message);
  };
  return { saveReport, deleteReport, deleteReports, deleting };
}
