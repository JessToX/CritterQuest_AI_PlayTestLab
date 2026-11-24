'use client';
import { useState, useRef, useCallback } from 'react';
import { save, removeRecord } from '@/lib/client/records';
import type { GameRecord } from '@/lib/playtest/types';
import type { MemoryEntry } from '@/lib/memory/types';

export function useWorkspaceRecords(setMessage: (message: string) => void) {
  const [unsavedGame, setUnsavedGame] = useState<GameRecord | null>(null);
  const pendingSave = useRef<GameRecord | null>(null);
  const [retryingSave, setRetryingSave] = useState(false);
  const retryingSaveRef = useRef(false);
  const [games, setGames] = useState<GameRecord[]>([]),
    [current, setCurrent] = useState<GameRecord | null>(null),
    [memories, setMemories] = useState<MemoryEntry[]>([]);
  // Batch callbacks need the latest saved memory even before React renders again.
  const memoryRef = useRef<MemoryEntry[]>([]);
  const loadMemories = useCallback((entries: MemoryEntry[]) => {
    memoryRef.current = entries;
    setMemories(entries);
  }, []);
  async function persistGame(g: GameRecord) {
    if (pendingSave.current && pendingSave.current.id !== g.id)
      throw new Error('请先重试保存待保存的对局');
    try {
      await save(g.id, 'game', g);
      if (pendingSave.current?.id === g.id) {
        pendingSave.current = null;
        setUnsavedGame(null);
      }
    } catch (e) {
      pendingSave.current = structuredClone(g);
      setUnsavedGame(pendingSave.current);
      setGames((old) => [
        structuredClone(g),
        ...old.filter((item) => item.id !== g.id),
      ]);
      throw e;
    }
  }
  async function persistMemory(entry: MemoryEntry) {
    await save(entry.id, 'memory', entry);
    loadMemories(
      memoryRef.current.some((candidate) => candidate.id === entry.id)
        ? memoryRef.current.map((candidate) =>
            candidate.id === entry.id ? entry : candidate,
          )
        : [...memoryRef.current, entry],
    );
  }
  async function deleteMemory(entry: MemoryEntry) {
    await removeRecord(entry.id, 'memory');
    loadMemories(
      memoryRef.current.filter((candidate) => candidate.id !== entry.id),
    );
  }
  async function retryPendingSave() {
    const pending = pendingSave.current;
    if (!pending || retryingSaveRef.current) return;
    retryingSaveRef.current = true;
    setRetryingSave(true);
    try {
      await persistGame(pending);
      setMessage('已重新保存对局');
    } catch {
      setMessage('保存仍失败，请重试');
    } finally {
      retryingSaveRef.current = false;
      setRetryingSave(false);
    }
  }
  function replaceGame(game: GameRecord) {
    setGames((old) =>
      old.map((candidate) => (candidate.id === game.id ? game : candidate)),
    );
    setCurrent((selected) => (selected?.id === game.id ? game : selected));
  }
  function upsertGame(game: GameRecord) {
    setGames((old) => [
      game,
      ...old.filter((candidate) => candidate.id !== game.id),
    ]);
  }
  function removeGameFromState(game: GameRecord) {
    setGames((old) => old.filter((candidate) => candidate.id !== game.id));
    setCurrent((selected) => (selected?.id === game.id ? null : selected));
  }
  return {
    games,
    setGames,
    current,
    setCurrent,
    memories,
    loadMemories,
    readMemories: () => memoryRef.current,
    persistGame,
    persistMemory,
    deleteMemory,
    hasPendingSave: () => pendingSave.current !== null,
    unsavedGame,
    retryPendingSave,
    retryingSave,
    replaceGame,
    upsertGame,
    removeGameFromState,
  };
}
