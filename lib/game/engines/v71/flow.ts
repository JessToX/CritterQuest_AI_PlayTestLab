import { log } from '../../events.ts';
import { foodLabel } from '../../labels.ts';
import { isFood, marketPrice, marketCardLabel } from '../../market.ts';
import { marketState } from '../../market-types.ts';
import type { GameState } from '../../types.ts';
import { drawCard, fillMarket } from './cards.ts';

export const activePlayer = (state: GameState) =>
  state.players[state.activePlayerIndex];

export function startTurn(input: GameState): GameState {
  if (input.status !== 'active' || input.phase !== 'start') return input;
  const state = structuredClone(input),
    m = marketState(state),
    p = activePlayer(state);
  m.submittedThisTurn = false;
  fillMarket(state);
  m.refreshAvailable = m.market.length > 0 && !m.market.some(isFood);
  state.phase = 'buy';
  state.decisionPlayerId = p.id;
  log(
    state,
    'effect',
    `${p.name} 开始购买阶段${m.refreshAvailable ? '；市场全为事件，可免费刷新一次' : ''}`,
    p.id,
    {
      v71: 'turn_start',
      allEventMarket: m.refreshAvailable,
      coins: m.accounts[p.id].coins,
      foodCount: p.questRow.length,
      affordableCards: m.market.filter(
        (c) => marketPrice(c) <= m.accounts[p.id].coins,
      ).length,
    },
  );
  return state;
}

// Pending steps hold physical event cards until their entire nested chain finishes.
// This is also the save/resume boundary for recipient-owned choices.
export function advance(state: GameState) {
  const m = marketState(state);
  while (m.pending.length) {
    const step = m.pending[0];
    if (step.kind === 'rotten_choice' || step.kind === 'fresh_choice') {
      state.phase = 'resolve';
      state.decisionPlayerId = step.recipientId;
      return;
    }
    m.pending.shift();
    if (step.kind === 'discard_event') {
      m.discard.push(step.card);
      continue;
    }
    if (step.kind === 'draw') {
      const card = drawCard(state);
      log(
        state,
        'draw',
        `${state.players.find((p) => p.id === step.recipientId)!.name} ${step.source === 'normal' ? '正常' : 'Super 追加'}抽牌${card ? '：' + marketCardLabel(card) : '：无牌可抽'}`,
        step.recipientId,
        {
          v71: 'draw',
          source: step.source,
          cardId: card?.id,
          cardKind: card ? (isFood(card) ? 'food' : card.event) : 'empty',
        },
      );
      if (card)
        m.pending.unshift({
          kind: 'acquire',
          recipientId: step.recipientId,
          card,
        });
      continue;
    }
    const { card, recipientId } = step;
    const recipient = state.players.find((p) => p.id === recipientId)!;
    if (isFood(card)) {
      recipient.questRow.push(card);
      log(
        state,
        'place',
        `${recipient.name} 取得${foodLabel(card)}`,
        recipientId,
        { v71: 'food', cardId: card.id },
      );
    } else if (card.event === 'super') {
      m.pending.unshift(
        { kind: 'draw', recipientId, source: 'super' },
        { kind: 'discard_event', card },
      );
      log(
        state,
        'effect',
        `${recipient.name} 结算 Super，追加抽一张`,
        recipientId,
        { v71: 'super', cardId: card.id },
      );
    } else if (card.event === 'coins') {
      const account = m.accounts[recipientId];
      const amount = card.amount!;
      // Positive events are discarded before the bank payout, per section 05.
      if (amount > 0) m.discard.push(card);
      const delta =
        amount > 0
          ? Math.min(amount, m.bank)
          : -Math.min(-amount, account.coins);
      account.coins += delta;
      m.bank -= delta;
      if (amount < 0) m.discard.push(card);
      log(
        state,
        'effect',
        `${recipient.name} ${delta >= 0 ? '获得' : '交回'} ${Math.abs(delta)} 币`,
        recipientId,
        {
          v71: 'coins',
          cardId: card.id,
          requested: amount,
          delta,
          bank: m.bank,
        },
      );
    } else {
      const available =
        recipient.questRow.length > 0 &&
        (card.event === 'rotten' || m.market.some(isFood));
      if (available)
        m.pending.unshift({
          kind: card.event === 'rotten' ? 'rotten_choice' : 'fresh_choice',
          recipientId,
          card,
        });
      else {
        m.discard.push(card);
        log(
          state,
          'effect',
          `${recipient.name} 的 ${marketCardLabel(card)} 无目标，跳过`,
          recipientId,
          { v71: 'event_skipped', cardId: card.id, event: card.event },
        );
      }
    }
  }
  state.phase = m.resumePhase;
  state.decisionPlayerId = activePlayer(state).id;
  if (state.phase === 'order_after' && m.submittedThisTurn) cleanup(state);
}
export function normalDraw(state: GameState) {
  const m = marketState(state);
  m.resumePhase = 'order_after';
  m.pending.push({
    kind: 'draw',
    recipientId: activePlayer(state).id,
    source: 'normal',
  });
  advance(state);
}
export function cleanup(state: GameState) {
  const p = activePlayer(state);
  state.phase = 'cleanup';
  state.decisionPlayerId = p.id;
  if (
    state.config.foodLimit !== 0 &&
    p.questRow.length > state.config.foodLimit
  )
    return;
  log(state, 'effect', `${p.name} 结束回合`, p.id, { v71: 'turn_end' });
  if (state.turn >= state.config.maxRounds * state.players.length) {
    state.status = 'draw';
    delete state.decisionPlayerId;
    log(
      state,
      'draw_game',
      '达到实验轮数上限，停止测试；不判胜负、不排名',
      undefined,
      { v71: 'test_limit' },
    );
    return;
  }
  state.turn++;
  state.round = Math.floor((state.turn - 1) / state.players.length) + 1;
  state.activePlayerIndex =
    (state.activePlayerIndex + 1) % state.players.length;
  state.phase = 'start';
  delete state.decisionPlayerId;
}
