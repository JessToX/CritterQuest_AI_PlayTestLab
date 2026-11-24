export const selectablePortraits = {
  geometric: '默认几何头像',
  otter: '水獭',
  bat: '蝙蝠',
  'red-panda': '小熊猫',
  owl: '猫头鹰',
  dragon: '龙',
  rabbit: '兔子',
  bear: '眼镜熊',
  'humpback-navigator': '座头鲸巡图员',
  'red-fox-dealer': '红狐校筹员',
  'raccoon-scorekeeper': '浣熊记分员',
} as const;

type SelectablePortrait = keyof typeof selectablePortraits;

export function seatTone(seatId: string, fallback = 0) {
  const match = /^seat-([0-3])$/.exec(seatId);
  return match ? Number(match[1]) : fallback;
}

export function resolvePortrait(choice?: unknown): SelectablePortrait {
  return typeof choice === 'string' &&
    Object.hasOwn(selectablePortraits, choice)
    ? (choice as SelectablePortrait)
    : 'geometric';
}

const prefix = 'cq.preview.seat-portrait.v1.';
const change = 'cq-seat-portrait-change';
const temporary = new Map<string, SelectablePortrait>();

export function readPortrait(seatId: string) {
  const pending = temporary.get(seatId);
  if (pending) return pending;
  try {
    return resolvePortrait(window.localStorage.getItem(prefix + seatId));
  } catch {
    return 'geometric';
  }
}

export function selectPortrait(seatId: string, choice: string) {
  const animal = resolvePortrait(choice);
  try {
    window.localStorage.setItem(prefix + seatId, animal);
    temporary.delete(seatId);
  } catch {
    // Keep this tab usable when the browser denies persistent storage.
    temporary.set(seatId, animal);
  }
  window.dispatchEvent(new Event(change));
}

export function subscribePortraits(update: () => void) {
  function onStorage(event: StorageEvent) {
    if (event.key === null || event.key.startsWith(prefix)) update();
  }
  window.addEventListener(change, update);
  window.addEventListener('storage', onStorage);
  return () => {
    window.removeEventListener(change, update);
    window.removeEventListener('storage', onStorage);
  };
}
