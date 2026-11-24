import { CritterPortrait } from '@/components/lab/critter-portrait';
import { seatTone } from '@/lib/client/seat-portraits';
import { readableText } from '@/lib/game/labels';
import type { GameRecord } from '@/lib/playtest/types';

/** Read-only presentation of actual lifecycle state or an already-public message. */
export function LiveScene({
  game,
  running,
  stopping,
  summarizing,
  unsaved,
}: {
  game: GameRecord;
  running: boolean;
  stopping: boolean;
  summarizing: boolean;
  unsaved: boolean;
}) {
  const publicIndex = game.chat.findLastIndex(
    (entry) =>
      entry.channel === 'public-table-v1' && entry.turn === game.state.turn,
  );
  const playing = running && game.status === 'running' && !stopping;
  const speaking =
    playing && !summarizing && !unsaved && game.chat[publicIndex];
  const active = game.state.players.findIndex(
    (player) => player.id === game.state.decisionPlayerId,
  );
  const speaker = speaking
    ? game.seats.findIndex((seat) => seat.name === speaking.speaker)
    : active;
  const paused = !playing;
  const seat = game.seats[Math.max(0, speaker)];
  const seatId = seat?.id ?? '';
  const cut = speaking
    ? `${game.id}-line-${publicIndex}`
    : `${game.id}-seat-${seatId}-${paused}`;
  const title = unsaved
    ? '保存未完成，请先重试保存。'
    : stopping
      ? '正在停下，等待当前步骤收尾。'
      : summarizing
        ? '整理这一局，留下总结。'
        : game.status === 'paused'
          ? `先停在第 ${game.state.turn} 回合。`
          : game.status === 'complete'
            ? '本局结束，回看每一步。'
            : game.status === 'terminated'
              ? '本局已终止，记录仍可查阅。'
              : '观察牌桌，等待下一次选择。';
  const text = speaking ? Array.from(speaking.message) : [];
  const action =
    playing && !summarizing && !unsaved
      ? game.state.events.findLast(
          (event) =>
            event.turn === game.state.turn &&
            event.type !== 'chat' &&
            event.publicText,
        )
      : undefined;
  return (
    <section
      className="cq-live-scene"
      data-paused={paused}
      data-unsaved={unsaved}
      aria-label="当前对局分镜"
    >
      <CritterPortrait
        key={`portrait-${cut}`}
        index={seatTone(seatId, Math.max(0, speaker))}
        portrait={seat?.portrait}
        paused={paused}
      />
      <div className="cq-live-scene-copy" key={`copy-${cut}`}>
        <span className="cq-live-caption">
          {speaking
            ? `${speaking.speaker} · T${speaking.turn} 公开桌聊节选`
            : `第 ${game.state.turn} 回合 · 对局状态`}
        </span>
        {speaking ? (
          <div className="cq-live-dialogue">
            <blockquote>
              {text.slice(0, 180).join('')}
              {text.length > 180 ? '…' : ''}
            </blockquote>
            <a href="#public-table-talk">查看完整桌聊</a>
          </div>
        ) : (
          <>
            <p className="cq-scene-state">{title}</p>
            <small>
              {unsaved
                ? '请使用上方“重试保存”；不要关闭页面。'
                : `${game.rule.label} · ${game.mode === 'simulation' ? '免费模拟' : 'API 对战'}`}
            </small>
          </>
        )}
      </div>
      {action && (
        <div className="cq-live-footnote">
          <strong>桌面动作</strong>
          <p>{readableText(action.publicText)}</p>
        </div>
      )}
    </section>
  );
}
