import type { Seat } from '../playtest/types.ts';
import type { MemoryEntry } from './types.ts';
export function memoryKey(seat: Seat, ruleId: string, mode: string) {
  return [
    seat.profile.id,
    seat.connection.kind,
    seat.connection.baseUrl,
    seat.profile.model,
    ruleId,
    mode,
  ].join('|');
}
export function memoriesFor(
  entries: MemoryEntry[],
  seat: Seat,
  ruleId: string,
  mode: string,
) {
  if (seat.profile.memoryMode === 'disabled') return [];
  return entries.filter(
    (e) =>
      e.active &&
      (e.agentId === memoryKey(seat, ruleId, mode) ||
        ((e.mode || e.agentId.split('|').at(-1)) === mode &&
          e.allowedReaders?.includes(memoryKey(seat, ruleId, mode)))) &&
      e.ruleVersion === ruleId,
  );
}
