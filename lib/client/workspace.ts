import { enrichMemory } from '../memory/management.ts';
import type { Seat } from '../playtest/types.ts';
import { load, loadRecords } from './records.ts';

// Load the complete workspace before publishing any of its initial state.
// Keys are restored separately from browser storage, never from saved profiles.
export async function loadWorkspace(initialSeats: Seat[]) {
  const [gamePage, memoryPage, rulePage, profiles, presets] = await Promise.all(
    [
      loadRecords('game'),
      loadRecords('memory'),
      loadRecords('rule'),
      load('profiles'),
      load('preset'),
    ],
  );
  const games = gamePage.records;
  const memories = memoryPage.records
    .map((entry) => enrichMemory(entry, games))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const seats = (profiles[0]?.seats || initialSeats).map((seat) => ({
    ...seat,
    connection: { ...seat.connection, apiKey: '' },
  }));
  return {
    games,
    memories,
    presets,
    seats,
    unsupported:
      gamePage.unsupported + memoryPage.unsupported + rulePage.unsupported,
  };
}
