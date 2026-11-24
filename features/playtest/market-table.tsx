import { foodNames, missionLabel } from '@/lib/game/labels';
import { isFood, marketCardLabel, marketPrice } from '@/lib/game/market';
import { marketState, type MarketCard } from '@/lib/game/market-types';
import { seatTone } from '@/lib/client/seat-portraits';
import type { GameRecord } from '@/lib/playtest/types';
import type { GameState } from '@/lib/game/types';
import { FoodGlyph, SeatAvatar } from '@/components/lab/primitives';
import {
  Bug,
  Check,
  Coins,
  Layers,
  RefreshCw,
  Sparkles,
  Store,
  Trophy,
} from 'lucide-react';

function CardSymbol({ card }: { card: MarketCard }) {
  if (isFood(card)) return <FoodGlyph food={card.food} size={30} />;
  const Icon = { super: Sparkles, rotten: Bug, fresh: RefreshCw, coins: Coins }[
    card.event
  ];
  return <Icon size={28} strokeWidth={1.6} aria-hidden="true" />;
}

export function MarketTable({
  state,
  seats,
  status,
  paused,
}: {
  state: GameState;
  seats: GameRecord['seats'];
  status: GameRecord['status'];
  paused: boolean;
}) {
  const m = marketState(state);
  return (
    <div className="cq-market">
      <div>
        <div className="cq-section-heading">
          <h3>
            <Store size={17} aria-hidden="true" />
            公开市场
          </h3>
          <span>食物 3 币 · 事件 2 币</span>
        </div>
        <div className="cq-market-grid">
          {Array.from({ length: 5 }, (_, i) => {
            const card = m.market[i];
            return card ? (
              <div
                key={card.id}
                className="cq-market-card cq-food-tone"
                data-food={isFood(card) ? card.food : 'event'}
                title={marketCardLabel(card)}
              >
                <small>{isFood(card) ? '食物' : '事件'}</small>
                <span className="cq-market-symbol">
                  <CardSymbol card={card} />
                </span>
                <strong>
                  {isFood(card) ? foodNames[card.food] : marketCardLabel(card)}
                </strong>
                <span className="cq-card-price">{marketPrice(card)} 币</span>
              </div>
            ) : (
              <div key={`empty-${i}`} className="cq-market-card cq-card-empty">
                <Layers size={22} strokeWidth={1.4} aria-hidden="true" />
                <span className="mt-2 text-xs">等待补货</span>
              </div>
            );
          })}
        </div>
        {m.refreshAvailable && (
          <p className="cq-market-note">
            全事件市场：本回合第一次购买前可免费刷新 1 张。
          </p>
        )}
      </div>
      <div>
        <div className="cq-section-heading">
          <h3>公共订单</h3>
          <span>
            {m.ordersToWin === 3 ? '标准 3 单' : '快速 2 单'}获胜 · 剩余{' '}
            {m.orderDeck.length} 张
          </span>
        </div>
        <div className="cq-order-grid">
          {m.orders.map((order) => (
            <div
              key={order.id}
              className="cq-order-card"
              aria-label={`${order.id}：${missionLabel(order)}`}
            >
              <div>
                <strong>{order.id}</strong>
                <span>订单需求</span>
              </div>
              <div className="cq-food-chips">
                {Object.entries(order.requirements)
                  .filter(([, n]) => n > 0)
                  .map(([food, n]) => (
                    <span
                      className="cq-food-chip cq-food-tone"
                      data-food={food}
                      key={food}
                      title={`${foodNames[food as keyof typeof foodNames]} × ${n}`}
                    >
                      <FoodGlyph
                        food={food as keyof typeof foodNames}
                        size={17}
                      />
                      <span className="sr-only">
                        {foodNames[food as keyof typeof foodNames]}
                      </span>
                      × {n}
                    </span>
                  ))}
              </div>
            </div>
          ))}
        </div>
      </div>
      <div>
        <div className="cq-section-heading">
          <h3>玩家食物区</h3>
          <span>
            {state.config.foodLimit
              ? `回合末上限 ${state.config.foodLimit} 张`
              : '无上限对照测试'}
          </span>
        </div>
        <div className="cq-player-grid">
          {state.players.map((p, i) => {
            const account = m.accounts[p.id];
            return (
              <div
                key={p.id}
                className="cq-player-card"
                data-active={!paused && p.id === state.decisionPlayerId}
                data-winner={p.id === state.winnerId}
              >
                <div className="cq-player-name">
                  <SeatAvatar
                    index={seatTone(seats[i]?.id ?? '', i)}
                    portrait={seats[i]?.portrait}
                    paused={paused}
                    small
                  />
                  <div>
                    <h3>{p.name}</h3>
                    <small>
                      {p.id === state.winnerId
                        ? '本局获胜'
                        : status === 'terminated'
                          ? '本局已终止'
                          : status === 'complete' || state.winnerId
                            ? '本局结束'
                            : paused
                              ? '待命'
                              : p.id === state.decisionPlayerId
                                ? '当前决策位'
                                : '等待回合'}
                    </small>
                  </div>
                  {p.id === state.winnerId && (
                    <Trophy
                      size={15}
                      className="text-amber-200 ml-auto"
                      aria-hidden="true"
                    />
                  )}
                </div>
                <div className="cq-player-coins">
                  <Coins size={14} aria-hidden="true" />
                  <strong>{account.coins}</strong> 币
                  <span className="ml-auto text-muted-foreground">
                    食物 {p.questRow.length} 张
                  </span>
                </div>
                <div className="cq-food-chips">
                  {Object.keys(foodNames).map((food) => {
                    const count = p.questRow.filter(
                      (card) => card.food === food,
                    ).length;
                    return count > 0 ? (
                      <span
                        className="cq-food-chip cq-food-tone"
                        data-food={food}
                        key={food}
                        title={`${foodNames[food as keyof typeof foodNames]} × ${count}`}
                      >
                        <FoodGlyph
                          food={food as keyof typeof foodNames}
                          size={15}
                        />
                        <span className="sr-only">
                          {foodNames[food as keyof typeof foodNames]}
                        </span>
                        {count}
                      </span>
                    ) : null;
                  })}
                  {!p.questRow.length && (
                    <span className="text-xs text-muted-foreground">
                      暂时没有食物
                    </span>
                  )}
                </div>
                <div className="cq-player-orders">
                  {Array.from({ length: m.ordersToWin }, (_, n) => (
                    <span
                      key={n}
                      className="cq-order-dot"
                      data-complete={n < account.completedOrders.length}
                      aria-hidden="true"
                    >
                      {n < account.completedOrders.length && (
                        <Check size={11} />
                      )}
                    </span>
                  ))}
                  <span>
                    已完成 {account.completedOrders.length} / {m.ordersToWin} 单
                  </span>
                </div>
                {!!account.completedOrders.length && (
                  <p className="text-[10px] text-muted-foreground mt-2">
                    已交：
                    {account.completedOrders
                      .map((order) => order.id)
                      .join(' · ')}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>
      <p className="text-[11px] text-muted-foreground flex flex-wrap gap-4">
        <span>公共储备 {m.bank} 币</span>
        <span>主牌堆 {m.deck.length} 张</span>
        <span>弃牌堆 {m.discard.length} 张</span>
      </p>
    </div>
  );
}
