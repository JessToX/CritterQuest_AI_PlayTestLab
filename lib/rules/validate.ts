import { UNSUPPORTED_RELEASE_VERSION } from '../game/registry.ts';
import type { RuleConfig } from '../game/types.ts';
export function validateConfig(value: unknown): RuleConfig {
  const c = value as RuleConfig;
  if (c?.mechanics === 'v7.1') {
    if (
      c.copies?.normal !== 12 ||
      c.copies?.super !== 0 ||
      c.copies?.rotten !== 0 ||
      c.patterns?.length !== 1 ||
      c.patterns[0] !== '2+1+1' ||
      ![2, 3].includes(c.ordersToWin ?? 3) ||
      !Number.isInteger(c.foodLimit) ||
      (c.foodLimit !== 0 && (c.foodLimit < 4 || c.foodLimit > 12)) ||
      !Number.isInteger(c.maxRounds) ||
      c.maxRounds < 1 ||
      c.maxRounds > 200
    )
      throw new Error(
        'V7.1 仅支持调整食物上限（0 表示无上限，或 4–12）、获胜订单数（2/3）和实验轮数；牌数、价格与订单固定',
      );
    return {
      mechanics: 'v7.1',
      copies: { normal: 12, super: 0, rotten: 0 },
      foodLimit: c.foodLimit,
      maxRounds: c.maxRounds,
      patterns: ['2+1+1'],
      ordersToWin: c.ordersToWin ?? 3,
    };
  }
  throw new Error(UNSUPPORTED_RELEASE_VERSION);
}
