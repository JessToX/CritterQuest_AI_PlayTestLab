import {
  credentialEndpoint,
  sameCredentialEndpoint,
} from '../agents/provider-endpoint.ts';
import type { GameRecord, Seat } from '../playtest/types.ts';

const STORAGE_KEY = 'critter-quest-api-keys-v2';
const LEGACY_STORAGE_KEY = 'critter-quest-api-keys-v1';

function identity(seat: Seat) {
  const endpoint = credentialEndpoint(seat.connection);
  return endpoint && JSON.stringify([seat.profile.id, endpoint]);
}

function readKeys(storage: Storage): Record<string, unknown> {
  const keys = JSON.parse(storage.getItem(STORAGE_KEY) || '{}');
  if (!keys || typeof keys !== 'object' || Array.isArray(keys))
    throw new Error('保存的 API Key 数据无法读取，请重新保存');
  return keys;
}

function savedKey(seat: Seat, keys: Record<string, unknown>) {
  const id = identity(seat);
  const key = id === null ? undefined : keys[id];
  return typeof key === 'string' ? key : '';
}

export function rememberKeys(seats: Seat[], storage: Storage) {
  const keys = readKeys(storage);
  for (const seat of seats) {
    const id = identity(seat);
    if (id === null) continue;
    const key = seat.connection.apiKey.trim();
    if (key) keys[id] = key;
    else delete keys[id];
  }
  storage.setItem(STORAGE_KEY, JSON.stringify(keys));
}

export function restoreKeys(seats: Seat[], storage: Storage): Seat[] {
  const keys = readKeys(storage);
  return seats.map((seat) => ({
    ...seat,
    connection: { ...seat.connection, apiKey: savedKey(seat, keys) },
  }));
}

export function forgetKeys(storage: Storage) {
  storage.removeItem(STORAGE_KEY);
  storage.removeItem(LEGACY_STORAGE_KEY);
}

export function restoreHistoricalKeys(
  game: GameRecord,
  seats: Seat[],
  storage: Storage,
): Seat[] {
  const keys = readKeys(storage);
  return seats.map((seat, index) => {
    const historical = game.seats[index];
    const connection = historical?.connection;
    const matches =
      game.mode === 'api' &&
      historical?.id === seat.profile.id &&
      connection &&
      sameCredentialEndpoint({ ...connection, apiKey: '' }, seat.connection);
    return {
      ...seat,
      connection: {
        ...seat.connection,
        apiKey: matches ? seat.connection.apiKey || savedKey(seat, keys) : '',
      },
    };
  });
}
