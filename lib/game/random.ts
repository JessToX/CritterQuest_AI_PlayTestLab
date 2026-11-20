import type { GameState } from './types.ts';

export function random(s: GameState) {
  const next = (s.rngState + 0x6d2b79f5) >>> 0;
  s.rngState = next;
  let n = next;
  n = Math.imul(n ^ (n >>> 15), n | 1);
  n ^= n + Math.imul(n ^ (n >>> 7), n | 61);
  return ((n ^ (n >>> 14)) >>> 0) / 4294967296;
}
export function shuffle<T>(s: GameState, items: T[]): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(random(s) * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
