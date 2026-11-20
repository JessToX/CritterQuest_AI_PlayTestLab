// License scope: V7.1 rules text and runtime entry points are mapped in LICENSE-SCOPE.md.
import { V71_FINAL_DOCUMENT } from '../../rules/v71-final-text.ts';
import { DEFAULT_CONFIG } from '../game/engine.ts';
import { OFFICIAL_RULE_ID } from '../game/registry.ts';
import type { RuleConfig } from '../game/types.ts';
import type { RuleVersion } from './types.ts';

export function adjudicationsFor(_config: RuleConfig) {
  return V71_IMPLEMENTATION_NOTES;
}
export const V71_IMPLEMENTATION_NOTES = `# V7.1 实现与测试口径

每局以 V7.1 正式规则正文、来源哈希及开局参数为准。
- 获币事件先弃置事件牌，再领取公共储备硬币；扣币事件先扣币再弃牌。
- 标准 2–4 人，随机先手，顺时针；48 普通食物、31 事件、12 公共订单、40 币。无角色、隐藏任务、技能或公共投票道具。
- 买 → 交 → 抽 → 交 → 整理，每回合最多交一单；标准第三单、快速第二单立即获胜。模式开局锁定。
- 每笔购买先付款，再补一张市场牌，再交给接收者处理；事件选择归接收者。Super 链后进先结算，全部完成后才弃置；事件链不可插入其他行动。
- 购买阶段开始先补市场空位；全无食物且有事件时可免费刷新一张，每回合最多一次、第一次购买前使用。展示事件不触发。
- 仅自己回合末检查 6 张食物上限；不发工资、交单奖励或额外硬币。公共储备与所有玩家合计恒为 40 币。
- copies 字段仅保留旧存储接口：normal=12 表示每种普通食物 12 张，super/rotten=0 表示不再是食物变体。31 张独立事件由 V7.1 引擎固定配置。
- 默认 100 轮是实验停止上限，不是胜利条件；上限停止、手动终止均无胜者、无排名。食物上限 0 是明确标记的无上限对照参数。
- 同种普通食物无附着状态，交单自动取所需实体牌；选择不同实体副本不改变玩法。
- 报告记录事实，不从少量模拟推断平衡、攻击强度或真人时长。AI 不接收牌堆顺序、随机状态或设计者私密说明。
`;
export const BASE_RULE: RuleVersion = {
  id: OFFICIAL_RULE_ID,
  config: DEFAULT_CONFIG,
  unsupported: [],
  label: 'V7.1 正式规则',
  text: V71_FINAL_DOCUMENT,
  hash: '596a5cb330b1fa03fbfbcc4d75898c6c4aa22439daa370c850fd89f317854f69',
  changes: [
    '正式玩家规则；统一获币先弃牌后领币的表述，清理过时试玩附录；玩法不变',
  ],
  createdAt: '2026-11-18T00:00:00+08:00',
};
export const BUILTIN_RULES = [BASE_RULE];
