import { v71Summary } from './v71-stats.ts';
import { marketState } from '../game/market-types.ts';
import {
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from 'docx';
import {
  actionLabel,
  readableText,
  savedActionLabel,
  taskNames,
} from '../game/labels.ts';
import type { GameAction } from '../game/types.ts';
import { type GameRecord } from '../playtest/types.ts';
import { analytics } from './analytics.ts';
import { reportFor } from './report.ts';
export const statusLabel = (s: GameRecord['status']) =>
  ({
    running: '进行中',
    paused: '已暂停',
    complete: '已完成',
    terminated: '已终止',
  })[s];
export function reportDocument(games: GameRecord[]) {
  const p = (text: string) =>
    new Paragraph({ children: [new TextRun(text)], spacing: { after: 100 } });
  const h = (text: string) =>
    new Paragraph({ text, heading: HeadingLevel.HEADING_1 });
  const table = (rows: string[][]) =>
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: rows.map(
        (row, i) =>
          new TableRow({
            tableHeader: i === 0,
            cantSplit: true,
            children: row.map((text) => new TableCell({ children: [p(text)] })),
          }),
      ),
    });
  const children: (Paragraph | Table)[] = [
    new Paragraph({
      text: 'Critter Quest 对局测试报告',
      heading: HeadingLevel.TITLE,
    }),
    p(
      `共收录 ${games.length} 局。游戏结果独立于总结状态；只有完成局计入胜率。真实 API 与模拟分开统计，未知 Token 用量不视为零。`,
    ),
  ];
  for (const mode of ['api', 'simulation'] as const) {
    const group = games.filter((g) => g.mode === mode),
      done = group.filter((g) => g.status === 'complete');
    children.push(
      h(mode === 'api' ? '真实 API 汇总' : '模拟汇总'),
      p(
        `总计 ${group.length} 局，完成 ${done.length} 局，终止 ${group.filter((g) => g.status === 'terminated').length} 局，暂停 ${group.filter((g) => g.status === 'paused').length} 局，进行中 ${group.filter((g) => g.status === 'running').length} 局。`,
      ),
    );
    const data = analytics(group);
    if (data.groups.length) {
      children.push(h('实验条件与结果'));
      for (const r of data.groups)
        children.push(
          p(r.label),
          p(
            `完成 ${r.ended}，未完成 ${r.unfinished}；胜率 ${r.winRate === null ? '无数据' : (r.winRate * 100).toFixed(1) + '%'}；获胜者平均轮数 ${r.meanWinningRounds?.toFixed(1) || '无数据'}。`,
          ),
        );
      children.push(
        p(
          '完成轮数仅统计获胜者。不同实验条件与小样本不能直接用于判断游戏平衡。',
        ),
      );
    }
    if (data.models.length) {
      children.push(h('模型稳定性'));
      for (const r of data.models)
        children.push(
          p(r.label),
          p(
            `调用 ${r.calls}；超时 ${r.timeouts}；取消 ${r.cancelled}；错误 ${r.errors}；P50 ${(r.p50 / 1000).toFixed(1)} 秒，P95 ${(r.p95 / 1000).toFixed(1)} 秒；已知输入 ${r.inputTokens}、输出 ${r.outputTokens} Token；${r.unknown} 次用量未知。`,
          ),
        );
    }
  }
  for (const g of games) {
    const r = reportFor(g);
    const market = marketState(g.state);
    children.push(
      new Paragraph({
        text: g.title || `对局 ${g.id}`,
        heading: HeadingLevel.HEADING_1,
        pageBreakBefore: true,
      }),
      p(
        `${g.mode === 'api' ? '真实 API' : '模拟'} · ${statusLabel(g.status)} · ${g.rule.label} · ${g.createdAt}`,
      ),
      p(
        `编号 ${g.id}；当前第 ${r.rounds} 轮，已完成 ${r.completedRounds} 轮，玩家回合 ${r.turns}；结果 ${r.winner}`,
      ),
      p(
        `玩家人数 ${g.state.players.length}；先手 ${g.initialFirstPlayerId ?? '未记录'}；种子 ${g.state.seed}；公共订单 ${market.ordersToWin} 单获胜；食物上限 ${g.state.config.foodLimit || '无上限对照'}。`,
      ),
    );
    if (g.experiment)
      children.push(
        p(
          `批次 ${g.experiment.batchId}；第 ${g.experiment.gameIndex + 1}/${g.experiment.plannedGames} 局；长期记忆预算 ${g.experiment.memoryBudgetChars} 字符。`,
        ),
      );
    if (g.terminationReason)
      children.push(
        p(`终止原因：${g.terminationReason}；时间：${g.terminatedAt}`),
      );
    children.push(
      h('人工备注'),
      p(g.notes || '无'),
      h('参与 AI'),
      table([
        ['Agent 与模型', '硬币与已完成公共订单'],
        ...g.seats.map((s, i) => [
          `${s.name} (${s.id})\n${s.provider}\n${s.model}\n记忆：${s.memoryMode}`,
          `${market.accounts[g.state.players[i].id].coins} 币；已完成 ${market.accounts[g.state.players[i].id].completedOrders.map((o) => o.id).join('、') || '无'}；公开食物 ${g.state.players[i].questRow.length} 张`,
        ]),
      ]),
      h('调用与游戏统计'),
      p(
        `调用 ${r.calls} 次，错误 ${r.errors} 次，取消 ${r.cancellations} 次；已知输入 Token ${r.inputTokens}，已知输出 Token ${r.outputTokens}；${r.unknownUsageCalls} 次用量未取得。平均延迟 ${r.averageLatencyMs} ms。`,
      ),
    );
    if (r.v71) {
      children.push(h('V7.1 试玩指标'), ...v71Summary(r.v71).map(p));
      for (const player of r.v71.players)
        children.push(
          p(
            `${g.state.players.find((p) => p.id === player.playerId)?.name}：本人回合 ${player.turns}，完成回合 ${player.completedTurns}；购买食物 ${player.foodPurchases}，事件 ${player.eventPurchases}，赠送 ${player.gifts}，购买 Rotten 给对手 ${player.rottenAttacks}；单回合最多购买 ${player.maxPurchasesInTurn}；无购买且无交单的完整回合 ${player.turnsWithoutBuyOrOrder}。`,
          ),
          p(
            `交单：${player.completedOrders.map((o) => `${o.orderId} 本人第 ${o.personalTurn} 回合（总回合 ${o.turn}，${o.window === 'order_before' ? '抽前' : '抽后'}）`).join('；') || '无'}`,
          ),
        );
    }
    for (const s of g.seats)
      if (s.modelSettings)
        children.push(
          p(
            `${s.name} 参数：决策 ${s.modelSettings.decisionTimeoutSeconds ?? 180} 秒；桌聊 ${s.modelSettings.chatTimeoutSeconds ?? 60} 秒；总结 ${s.modelSettings.summaryTimeoutSeconds ?? 180} 秒；输出预算 ${s.modelSettings.maxOutputTokens ?? '原设置'}；思考强度 ${s.modelSettings.reasoningEffort || '原设置'}；思考模式 ${s.modelSettings.thinking || '原设置'}。`,
          ),
        );
    children.push(h('各 AI 原始反思'));
    for (const [id, text] of Object.entries(g.reflections)) {
      const index = g.state.players.findIndex((p) => p.id === id);
      const s = g.seats[index];
      children.push(
        p(`原作者：${s ? `${s.name} · ${s.provider} · ${s.model}` : id}`),
        ...text.split('\n').map(p),
      );
    }
    if (!Object.keys(g.reflections).length) children.push(p('尚未生成反思。'));
    children.push(h('阶段总结与生成状态'));
    for (const job of g.summaryJobs || [])
      children.push(
        p(
          `${g.state.players.find((p) => p.id === job.playerId)?.name} · ${job.kind === 'checkpoint' ? `第 ${job.round} 轮阶段总结` : '收尾反思'} · ${{ complete: '已生成', pending: '等待生成', failed: '失败', cancelled: '已取消' }[job.status]}`,
        ),
        ...(
          (job.kind === 'checkpoint' ? job.content : undefined) ||
          job.error ||
          '详见单局反思'
        )
          .split('\n')
          .map(p),
      );
    children.push(h('调用错误明细'));
    for (const c of g.calls.filter((c) => c.error))
      children.push(
        p(
          `第 ${c.round || '未记录'} 轮，玩家回合 ${c.turn} · ${g.seats.find((s) => s.id === c.seatId)?.name} · ${c.model || g.seats.find((s) => s.id === c.seatId)?.model} · ${taskNames[c.task] || c.task} · ${(c.latencyMs / 1000).toFixed(1)} 秒`,
        ),
        p(c.error!),
        p(
          `请求标识：${c.requestId || '未取得'}；阶段：${c.details?.phase || '旧记录未确定'}。`,
        ),
      );
    children.push(h('完整已记录过程'));
    const turns = [
      ...new Set([
        ...g.state.events.map((e) => e.turn),
        ...g.chat.map((c) => c.turn),
        ...(g.decisions || []).map((d) => d.turn),
      ]),
    ].sort((a, b) => a - b);
    for (const turn of turns) {
      children.push(
        new Paragraph({
          text: `玩家回合 ${turn}`,
          heading: HeadingLevel.HEADING_2,
        }),
      );
      for (const e of g.state.events.filter((e) => e.turn === turn)) {
        children.push(p(readableText(e.publicText)));
        if (typeof e.payload?.cardId === 'string')
          children.push(p(`设计者记录：${readableText(e.payload.cardId)}`));
        if (e.payload?.action)
          children.push(p(actionLabel(e.payload.action as GameAction)));
      }
      for (const d of g.decisions?.filter((d) => d.turn === turn) || [])
        children.push(
          p(
            `${d.name} · ${savedActionLabel(d.label, d.action)} · ${d.status === 'executed' ? '已执行' : '未执行'}`,
          ),
          p(`决策说明：${d.reason || '未提供'}`),
        );
      for (const c of g.chat.filter((c) => c.turn === turn))
        children.push(p(`公开对话 · ${c.speaker}：${c.message}`));
      for (const c of g.chatChoices?.filter(
        (c) => c.turn === turn && c.failed,
      ) || [])
        children.push(p(`${c.speaker} 本次发言未取得：${c.error}`));
    }
  }
  return new Document({
    styles: {
      default: {
        title: { run: { color: '000000' } },
        heading1: { run: { color: '000000' } },
        document: {
          run: {
            font: {
              ascii: 'Arial',
              hAnsi: 'Arial',
              eastAsia: 'Songti SC',
              cs: 'Arial',
            },
            size: 22,
          },
          paragraph: { spacing: { line: 300 } },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            size: { width: 11906, height: 16838 },
            margin: { top: 1134, bottom: 1134, left: 1134, right: 1134 },
          },
        },
        children,
      },
    ],
  });
}
export async function exportReports(games: GameRecord[]) {
  const blob = await Packer.toBlob(reportDocument(games));
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download =
    games.length === 1
      ? `critter-quest-${games[0].id}.docx`
      : 'critter-quest-reports.docx';
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
