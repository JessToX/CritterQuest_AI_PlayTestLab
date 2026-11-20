// License scope: V7.1 card terminology and UI helpers are mapped in LICENSE-SCOPE.md.
import type { FoodCard, GameAction, Mission } from './types.ts';
export const foodNames = {
  fish: '鱼',
  bone: '骨头',
  cheese: '奶酪',
  seed: '种子',
};
export const phaseNames: Partial<
  Record<import('./types.ts').GameState['phase'], string>
> = {
  start: '准备回合',
  resolve: '选择效果目标',
  cleanup: '整理食物',
  buy: '购买阶段',
  order_before: '抽牌前交单',
  order_after: '抽牌后交单',
};
export const actionNames: Record<GameAction['type'], string> = {
  buy: '购买市场牌',
  refresh_market: '免费刷新市场',
  end_buy: '结束购买',
  submit_order: '交公共订单',
  skip_order: '暂不交单',
  rotten_discard: 'Rotten 弃食物',
  fresh_swap: 'Fresh 交换食物',
  discard: '弃牌整理',
};
export function foodLabel(c: FoodCard) {
  return (
    (c.variant === 'super'
      ? '超级'
      : c.variant === 'rotten'
        ? '变质'
        : '普通') + foodNames[c.food]
  );
}
export function missionLabel(m: Mission | null | undefined) {
  if (!m) return '公共订单';
  return Object.entries(m.requirements)
    .filter(([, n]) => n)
    .map(([f, n]) => foodNames[f as keyof typeof foodNames] + ' × ' + n)
    .join('、');
}

export function readableText(text: string) {
  return text
    .replace(
      /\b(fish|bone|cheese|seed)-(normal|super|rotten)-\d+\b/g,
      (_, food: keyof typeof foodNames, variant: FoodCard['variant']) =>
        foodLabel({ id: '', food, variant }),
    )
    .replace(
      /Rotten (fish|bone|cheese|seed)/g,
      (_, food: keyof typeof foodNames) => '变质' + foodNames[food],
    )
    .replace(/\bFood\b/g, '食物');
}
export function actionLabel(
  action: GameAction,
  state?: import('./types.ts').GameState,
  _actorId?: string,
): string {
  const person = (id?: string) =>
    state?.players.find((p) => p.id === id)?.name ||
    (id ? '玩家 ' + id.replace('player-', '') : '目标玩家');
  const card = (id?: string) => (id ? readableText(id) : '食物');
  switch (action.type) {
    case 'buy':
      return `购买 ${card(action.cardId)}，给${person(action.recipientId)}`;
    case 'refresh_market':
      return `免费刷新 ${card(action.cardId)}`;
    case 'end_buy':
      return '结束购买，进入交单窗口';
    case 'submit_order':
      return `完成公共订单 ${action.orderId}`;
    case 'skip_order':
      return '暂不交单';
    case 'rotten_discard':
      return `Rotten：弃掉${card(action.cardId)}`;
    case 'fresh_swap':
      return `Fresh：用${card(action.foodId)}交换市场${card(action.marketCardId)}`;
    case 'discard':
      return `整理食物，弃掉${card(action.cardId)}`;
    default:
      return '此版本不支持该动作';
  }
}
export function savedActionLabel(label: string, action?: GameAction) {
  if (action && label.trim().startsWith('{')) return actionLabel(action);
  if (label.trim().startsWith('{')) {
    try {
      return actionLabel(JSON.parse(label));
    } catch {
      return '历史动作详情不完整';
    }
  }
  return readableText(label);
}
export const taskNames: Record<string, string> = {
  decision: '行动决策',
  chat: '公开桌聊',
  checkpoint: '阶段总结',
  reflection: '单局反思',
  batch: '十局总结',
  test: '连接测试',
};
