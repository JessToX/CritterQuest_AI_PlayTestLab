import {
  credentialEndpoint,
  sameCredentialEndpoint,
} from '../agents/provider-endpoint.ts';
import type { ProviderConnection } from '../agents/types.ts';
import type { GameRecord, Seat } from './types.ts';

// Restore historical configuration without replacing the current setup or copying its key to a different endpoint.
export function resumeSeats(game: GameRecord, current: Seat[]): Seat[] {
  return game.seats.map((saved) => {
    const matching = current.find((seat) => seat.profile.id === saved.id);
    const historical = saved.connection && { ...saved.connection, apiKey: '' };
    let connection: ProviderConnection;
    if (historical && credentialEndpoint(historical)) {
      connection = historical;
      if (
        game.mode === 'api' &&
        matching &&
        sameCredentialEndpoint(matching.connection, historical)
      )
        connection.apiKey = matching.connection.apiKey;
    } else {
      const fingerprint = saved.connectionFingerprint ?? '';
      const split = fingerprint.indexOf('|');
      const mode = historical?.kind || fingerprint.slice(0, split);
      const kind =
        mode === 'openai' || mode === 'anthropic' ? mode : 'openai-compatible';
      connection = {
        id:
          typeof historical?.id === 'string' && historical.id.trim()
            ? historical.id
            : kind === 'openai-compatible'
              ? 'custom'
              : kind,
        label: saved.provider,
        kind,
        baseUrl:
          historical?.baseUrl ||
          (split >= 0 ? fingerprint.slice(split + 1) : ''),
        apiKey: '',
      };
    }
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
      game.mode === 'api' &&
      (seat.profile.model !== saved.model ||
        !saved.connection ||
        !sameCredentialEndpoint(seat.connection, {
          ...saved.connection,
          apiKey: '',
        }) ||
        !seat.connection.apiKey.trim())
    )
      return null;
    restored.push({
      ...seat,
      connection: {
        ...seat.connection,
        apiKey: targeted && game.mode === 'api' ? seat.connection.apiKey : '',
      },
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
