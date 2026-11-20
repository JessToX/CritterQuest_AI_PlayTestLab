import type { GameEvent, GameState } from './types.ts';
import { readableText } from './labels.ts';

export function log(
  s: GameState,
  type: GameEvent['type'],
  text: string,
  actorId?: string,
  payload?: Record<string, unknown>,
  privateTextByPlayer?: Record<string, string>,
) {
  s.events.push({
    id: s.id + '-e' + s.events.length,
    turn: s.turn,
    round: s.round,
    actorId,
    type,
    publicText: readableText(text),
    payload,
    privateTextByPlayer,
  });
}
