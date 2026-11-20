import type { GameEvent } from '../game/types.ts';

export function v71Stats(events: GameEvent[]) {
  const matching = (kind: string) =>
    events.filter((e) => e.payload?.v71 === kind);
  const starts = matching('turn_start'),
    purchases = matching('purchase'),
    orders = matching('order'),
    refreshes = matching('refresh'),
    cleanup = matching('cleanup');
  const ids = [
    ...new Set(events.flatMap((e) => (e.actorId ? [e.actorId] : []))),
  ];
  const players = ids.map((playerId) => {
    const turns = starts.filter((e) => e.actorId === playerId);
    const bought = purchases.filter((e) => e.actorId === playerId);
    const completed = orders
      .filter((e) => e.actorId === playerId)
      .map((e) => ({
        orderId: String(e.payload!.orderId),
        turn: e.turn,
        round: e.round,
        personalTurn: turns.filter((t) => t.turn <= e.turn).length,
        window: String(e.payload!.window),
      }));
    const ended = matching('turn_end').filter((e) => e.actorId === playerId);
    return {
      playerId,
      turns: turns.length,
      completedTurns: ended.length,
      foodPurchases: bought.filter((e) => e.payload!.cardKind === 'food')
        .length,
      eventPurchases: bought.filter((e) => e.payload!.cardKind !== 'food')
        .length,
      gifts: bought.filter((e) => e.payload!.recipientId !== playerId).length,
      rottenAttacks: bought.filter(
        (e) =>
          e.payload!.cardKind === 'rotten' &&
          e.payload!.recipientId !== playerId,
      ).length,
      maxPurchasesInTurn: Math.max(
        0,
        ...turns.map((t) => bought.filter((e) => e.turn === t.turn).length),
      ),
      completedOrders: completed,
      // Observable waiting proxy, not a claim that no useful choice was possible.
      turnsWithoutBuyOrOrder: ended.filter(
        (t) =>
          !bought.some((e) => e.turn === t.turn) &&
          !completed.some((e) => e.turn === t.turn),
      ).length,
      noAffordableMarketAtStart: turns.filter(
        (e) => e.payload!.affordableCards === 0,
      ).length,
    };
  });
  return {
    players,
    foodPurchases: purchases.filter((e) => e.payload!.cardKind === 'food')
      .length,
    eventPurchases: purchases.filter((e) => e.payload!.cardKind !== 'food')
      .length,
    allEventMarketStarts: starts.filter((e) => e.payload!.allEventMarket)
      .length,
    refreshes: refreshes.length,
    refreshesFindingFood: refreshes.filter((e) => e.payload!.foodAppeared)
      .length,
    cleanupDiscards: cleanup.length,
    cleanupDiscardsNeededForOpenOrders: cleanup.filter(
      (e) =>
        Array.isArray(e.payload!.neededForOrders) &&
        e.payload!.neededForOrders.length > 0,
    ).length,
    cleanupEvidence: cleanup.map((e) => ({
      playerId: e.actorId,
      turn: e.turn,
      cardId: e.payload!.cardId,
      neededForOrders: e.payload!.neededForOrders,
    })),
    normalDraws: matching('draw').filter((e) => e.payload!.source === 'normal')
      .length,
    superDraws: matching('draw').filter((e) => e.payload!.source === 'super')
      .length,
    emptyDraws: matching('draw').filter((e) => e.payload!.cardKind === 'empty')
      .length,
    bankShortfalls: matching('coins').filter(
      (e) =>
        Number(e.payload!.requested) > 0 &&
        Number(e.payload!.delta) < Number(e.payload!.requested),
    ).length,
    stoppedAtTestLimit: matching('test_limit').length > 0,
  };
}
export function v71Summary(stats: ReturnType<typeof v71Stats>) {
  return [
    `购买：普通食物 ${stats.foodPurchases} 次，事件 ${stats.eventPurchases} 次。正常抽牌 ${stats.normalDraws} 次，Super 追加抽牌 ${stats.superDraws} 次。`,
    `购买阶段开始市场全为事件 ${stats.allEventMarketStarts} 次；免费刷新 ${stats.refreshes} 次，其中出现食物 ${stats.refreshesFindingFood} 次。`,
    `回合末超限弃牌 ${stats.cleanupDiscards} 张，其中 ${stats.cleanupDiscardsNeededForOpenOrders} 张会增加当前至少一张公开订单的缺口；这不等同于玩家下一单计划。`,
    `公共储备不足 ${stats.bankShortfalls} 次；无牌可抽 ${stats.emptyDraws} 次。${stats.stoppedAtTestLimit ? '达到实验轮数上限，无胜者、无排名。' : ''}`,
    '以上为执行事实。模拟不代表真人时长、模型水平、先手优势或已验证的游戏平衡。',
  ];
}
