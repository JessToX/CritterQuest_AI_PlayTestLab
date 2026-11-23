import {
  credentialEndpoint,
  sameCredentialEndpoint,
} from '../agents/provider-endpoint.ts';
import type { ProviderConnection } from '../agents/types.ts';
import { connectionFingerprint } from './experiment.ts';
import type { GameRecord, Seat } from './types.ts';

// Restore historical configuration without replacing the current setup or copying its key to a different endpoint.
export function resumeSeats(game: GameRecord, current: Seat[]): Seat[] {
  return game.seats.map((saved) => {
    const fingerprint = saved.connectionFingerprint;
    const matching = current.find(
      (s) =>
        s.profile.id === saved.id &&
        (fingerprint
          ? connectionFingerprint(s.connection) === fingerprint
          : s.connection.label === saved.provider),
    );
    let connection: ProviderConnection;
    if (saved.connection) connection = { ...saved.connection, apiKey: '' };
    else if (fingerprint) {
      const split = fingerprint.indexOf('|'),
        kind = fingerprint.slice(0, split);
      if (!['openai', 'anthropic', 'openai-compatible'].includes(kind))
        throw new Error('旧对局接口信息无法识别');
      connection = {
        id:
          matching?.connection.id ||
          (kind === 'openai-compatible' ? 'custom' : kind),
        label: saved.provider,
        kind: kind as ProviderConnection['kind'],
        baseUrl: fingerprint.slice(split + 1),
        apiKey: '',
      };
    } else if (matching && saved.provider !== '自定义兼容 API')
      connection = { ...matching.connection, apiKey: '' };
    else
      connection = {
        id: 'custom',
        label: saved.provider,
        kind: 'openai-compatible',
        baseUrl: '',
        apiKey: '',
      };
    if (matching && sameCredentialEndpoint(matching.connection, connection))
      connection.apiKey = matching.connection.apiKey;
    return {
      enabled: true,
      connection,
      profile: {
        id: saved.id,
        name: saved.name,
        providerId: connection.id,
        model: saved.model,
        customInstructions: saved.customInstructions,
        memoryMode: saved.memoryMode as Seat['profile']['memoryMode'],
        modelSettings: structuredClone(saved.modelSettings),
      },
    };
  });
}
export function needsResumeInput(seats: Seat[], mode: GameRecord['mode']) {
  return (
    mode === 'api' &&
    seats.some(
      (s) => !s.connection.apiKey.trim() || !credentialEndpoint(s.connection),
    )
  );
}

// Summary repair retains its existing, stricter matching policy: every historical
// seat must exist, but only the requested player needs matching credentials.
export function summarySeats(
  game: GameRecord,
  current: Seat[],
  playerId?: string,
): Seat[] | null {
  const restored: Seat[] = [];
  for (const [index, saved] of game.seats.entries()) {
    const seat = current.find((candidate) => candidate.profile.id === saved.id);
    if (!seat) return null;
    const targeted = !playerId || game.state.players[index].id === playerId;
    if (
      targeted &&
      (seat.profile.model !== saved.model ||
        (saved.connectionFingerprint &&
          connectionFingerprint(seat.connection) !==
            saved.connectionFingerprint) ||
        (game.mode === 'api' && !seat.connection.apiKey))
    )
      return null;
    restored.push({
      ...seat,
      profile: {
        ...seat.profile,
        name: saved.name,
        model: saved.model,
        customInstructions: saved.customInstructions,
        memoryMode: saved.memoryMode as Seat['profile']['memoryMode'],
        modelSettings: {
          ...saved.modelSettings,
          summaryTimeoutSeconds:
            seat.profile.modelSettings?.summaryTimeoutSeconds ??
            saved.modelSettings?.summaryTimeoutSeconds,
        },
      },
    });
  }
  return restored;
}
