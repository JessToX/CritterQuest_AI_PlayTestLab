import { log } from '../../events.ts';
import { foodLabel, missionLabel } from '../../labels.ts';
import {
  MARKET_FOODS as foods,
  canSubmit,
  isFood,
  marketPrice,
  marketCardLabel,
} from '../../market.ts';
import { marketState } from '../../market-types.ts';
import type { EventCard } from '../../market-types.ts';
import type {
  FoodCard,
  GameAction,
  GameState,
  LegalAction,
} from '../../types.ts';
import { drawCard } from './cards.ts';
import { activePlayer, advance, normalDraw, cleanup } from './flow.ts';

export function legalActions(state: GameState): LegalAction[] {
  if (state.status !== 'active' || state.phase === 'start') return [];
  const m = marketState(state),
    p = activePlayer(state);
  const actions: Array<{ action: GameAction; label: string }> = [];
  const add = (action: GameAction, label: string) =>
    actions.push({ action, label });
  const pending = m.pending[0];
  if (pending) {
    const recipient =
      'recipientId' in pending
        ? state.players.find((x) => x.id === pending.recipientId)!
        : undefined;
    if (pending.kind === 'rotten_choice')
      for (const card of recipient!.questRow)
        add(
          { type: 'rotten_discard', cardId: card.id },
          `Rotten：弃置自己的${foodLabel(card)}`,
        );
    if (pending.kind === 'fresh_choice')
      for (const own of recipient!.questRow)
        for (const card of m.market.filter(isFood))
          add(
            { type: 'fresh_swap', foodId: own.id, marketCardId: card.id },
            `Fresh：用自己的${foodLabel(own)}交换市场${foodLabel(card)}`,
          );
  } else if (state.phase === 'buy') {
    for (const card of m.market) {
      if (m.accounts[p.id].coins >= marketPrice(card))
        for (const recipient of state.players)
          add(
            { type: 'buy', cardId: card.id, recipientId: recipient.id },
            `花 ${marketPrice(card)} 币购买${marketCardLabel(card)}，给${recipient.id === p.id ? '自己' : recipient.name}`,
          );
      if (m.refreshAvailable)
        add(
          { type: 'refresh_market', cardId: card.id },
          `免费刷新${marketCardLabel(card)}`,
        );
    }
    add({ type: 'end_buy' }, '结束购买，进入第一次交单窗口');
  } else if (state.phase === 'order_before' || state.phase === 'order_after') {
    if (!m.submittedThisTurn)
      for (const order of m.orders)
        if (canSubmit(p.questRow, order))
          add(
            { type: 'submit_order', orderId: order.id },
            `交单 ${order.id}：${missionLabel(order)}`,
          );
    add(
      { type: 'skip_order' },
      state.phase === 'order_before'
        ? '暂不交单，正常抽牌'
        : '暂不交单，进入整理',
    );
  } else if (state.phase === 'cleanup') {
    for (const card of p.questRow)
      add(
        { type: 'discard', cardId: card.id },
        `整理：弃置${foodLabel(card)}至 ${state.config.foodLimit} 张`,
      );
  }
  return actions.map(({ action, label }) => ({
    id: JSON.stringify(action),
    action,
    label,
  }));
}

export function applyAction(input: GameState, action: GameAction): GameState {
  const chosen = legalActions(input).find(
    (a) => JSON.stringify(a.action) === JSON.stringify(action),
  );
  if (!chosen) throw new Error('非法 V7.1 动作');
  const state = structuredClone(input),
    m = marketState(state),
    p = activePlayer(state);
  log(state, 'action', chosen.label, state.decisionPlayerId, { action });
  if (action.type === 'buy') {
    m.refreshAvailable = false;
    const index = m.market.findIndex((c) => c.id === action.cardId),
      card = m.market.splice(index, 1)[0];
    const price = marketPrice(card);
    m.accounts[p.id].coins -= price;
    m.bank += price;
    // The purchased card is held outside every pile while refilling this one slot.
    const replacement = drawCard(state);
    if (replacement) m.market.splice(index, 0, replacement);
    log(
      state,
      'effect',
      `${p.name} 支付 ${price} 币；市场${replacement ? '补入' + marketCardLabel(replacement) : '留下空位'}`,
      p.id,
      {
        v71: 'purchase',
        cardId: card.id,
        cardKind: isFood(card) ? 'food' : card.event,
        recipientId: action.recipientId,
        price,
        replacementId: replacement?.id,
      },
    );
    m.resumePhase = 'buy';
    m.pending.push({ kind: 'acquire', recipientId: action.recipientId, card });
    advance(state);
  } else if (action.type === 'refresh_market') {
    m.refreshAvailable = false;
    const index = m.market.findIndex((c) => c.id === action.cardId),
      card = m.market.splice(index, 1)[0];
    m.discard.push(card);
    const replacement = drawCard(state);
    if (replacement) m.market.splice(index, 0, replacement);
    log(
      state,
      'effect',
      `免费刷新${marketCardLabel(card)}${replacement ? '，补入' + marketCardLabel(replacement) : '，无牌可补'}`,
      p.id,
      {
        v71: 'refresh',
        cardId: card.id,
        replacementId: replacement?.id,
        foodAppeared: !!replacement && isFood(replacement),
      },
    );
  } else if (action.type === 'end_buy') {
    m.refreshAvailable = false;
    state.phase = 'order_before';
  } else if (action.type === 'submit_order') {
    const window = state.phase;
    const order = m.orders.splice(
      m.orders.findIndex((o) => o.id === action.orderId),
      1,
    )[0];
    for (const food of foods)
      for (let i = 0; i < order.requirements[food]; i++)
        m.discard.push(
          p.questRow.splice(
            p.questRow.findIndex((c) => c.food === food),
            1,
          )[0],
        );
    m.accounts[p.id].completedOrders.push(order);
    m.submittedThisTurn = true;
    log(state, 'effect', `${p.name} 完成订单 ${order.id}`, p.id, {
      v71: 'order',
      orderId: order.id,
      window,
      completed: m.accounts[p.id].completedOrders.length,
    });
    if (m.accounts[p.id].completedOrders.length >= m.ordersToWin) {
      state.status = 'complete';
      state.winnerId = p.id;
      delete state.decisionPlayerId;
      log(state, 'win', `${p.name} 完成 ${m.ordersToWin} 单，立即获胜`, p.id, {
        v71: 'win',
      });
      return state;
    }
    const next = m.orderDeck.pop();
    if (next) m.orders.push(next);
    if (window === 'order_before') normalDraw(state);
    else cleanup(state);
  } else if (action.type === 'skip_order') {
    if (state.phase === 'order_before') normalDraw(state);
    else cleanup(state);
  } else if (action.type === 'rotten_discard') {
    const step = m.pending.shift()! as {
      kind: 'rotten_choice';
      recipientId: string;
      card: EventCard;
    };
    const recipient = state.players.find((x) => x.id === step.recipientId)!;
    m.discard.push(
      recipient.questRow.splice(
        recipient.questRow.findIndex((c) => c.id === action.cardId),
        1,
      )[0],
      step.card,
    );
    log(
      state,
      'effect',
      `${recipient.name} 弃掉一张普通食物，Rotten 结算完成`,
      recipient.id,
      { v71: 'rotten', cardId: step.card.id, foodId: action.cardId },
    );
    advance(state);
  } else if (action.type === 'fresh_swap') {
    const step = m.pending.shift()! as {
      kind: 'fresh_choice';
      recipientId: string;
      card: EventCard;
    };
    const recipient = state.players.find((x) => x.id === step.recipientId)!;
    const ownIndex = recipient.questRow.findIndex(
        (c) => c.id === action.foodId,
      ),
      marketIndex = m.market.findIndex((c) => c.id === action.marketCardId);
    const own = recipient.questRow[ownIndex];
    recipient.questRow[ownIndex] = m.market[marketIndex] as FoodCard;
    m.market[marketIndex] = own;
    m.discard.push(step.card);
    log(state, 'effect', `${recipient.name} 完成 Fresh 一换一`, recipient.id, {
      v71: 'fresh',
      foodId: action.foodId,
      marketCardId: action.marketCardId,
    });
    advance(state);
  } else if (action.type === 'discard') {
    const index = p.questRow.findIndex((c) => c.id === action.cardId),
      card = p.questRow[index];
    const neededForOrders = m.orders
      .filter(
        (o) =>
          o.requirements[card.food] >=
          p.questRow.filter((c) => c.food === card.food).length,
      )
      .map((o) => o.id);
    m.discard.push(p.questRow.splice(index, 1)[0]);
    log(state, 'cleanup', `${p.name} 超限弃置${foodLabel(card)}`, p.id, {
      v71: 'cleanup',
      cardId: card.id,
      neededForOrders,
    });
    cleanup(state);
  }
  return state;
}
