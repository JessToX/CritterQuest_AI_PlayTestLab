import { credentialEndpoint } from '../agents/provider-endpoint.ts';
import type { Seat } from '../playtest/types.ts';

const STORAGE_KEY = 'critter-quest-api-keys-v1';
function identity(seat: Seat) {
  return JSON.stringify([
    seat.profile.id,
    seat.connection.id,
    seat.connection.kind,
    seat.connection.baseUrl?.trim().replace(/\/+$/, '') || '',
  ]);
}
export function rememberKeys(seats: Seat[], storage: Storage) {
  const parsed = JSON.parse(storage.getItem(STORAGE_KEY) || '{}');
  const keys: Record<string, string> =
    parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed
      : {};
  for (const seat of seats) {
    if (credentialEndpoint(seat.connection) && seat.connection.apiKey.trim())
      keys[identity(seat)] = seat.connection.apiKey.trim();
    else delete keys[identity(seat)];
  }
  storage.setItem(STORAGE_KEY, JSON.stringify(keys));
}
export function restoreKeys(seats: Seat[], storage: Storage): Seat[] {
  const keys = JSON.parse(storage.getItem(STORAGE_KEY) || '{}');
  if (!keys || typeof keys !== 'object' || Array.isArray(keys))
    throw new Error('保存的 API Key 数据无法读取，请重新保存');
  return seats.map((seat) => ({
    ...seat,
    connection: {
      ...seat.connection,
      apiKey:
        credentialEndpoint(seat.connection) &&
        typeof keys[identity(seat)] === 'string'
          ? keys[identity(seat)]
          : '',
    },
  }));
}
export function forgetKeys(storage: Storage) {
  storage.removeItem(STORAGE_KEY);
}

export function restoreHistoricalKeys(seats: Seat[], storage: Storage): Seat[] {
  const keys = JSON.parse(storage.getItem(STORAGE_KEY) || '{}');
  return seats.map((seat) => {
    if (!credentialEndpoint(seat.connection))
      return { ...seat, connection: { ...seat.connection, apiKey: '' } };
    if (seat.connection.apiKey.trim()) return seat;
    let key =
      typeof keys[identity(seat)] === 'string' ? keys[identity(seat)] : '';
    if (!key) {
      const target = JSON.parse(identity(seat));
      const matches = Object.entries(keys).filter(([id, value]) => {
        try {
          const old = JSON.parse(id);
          return (
            typeof value === 'string' &&
            old[0] === target[0] &&
            old[2] === target[2] &&
            old[3] === target[3]
          );
        } catch {
          return false;
        }
      });
      const unique = [...new Set(matches.map(([, v]) => v))];
      if (unique.length === 1) key = unique[0];
    }
    return {
      ...seat,
      connection: {
        ...seat.connection,
        apiKey: typeof key === 'string' ? key : '',
      },
    };
  });
}
