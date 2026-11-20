# V7.1 候选维护

执行 `npm ci` 和 `npm run check`。检查依次执行架构、测试、类型、lint、格式和生产构建。规则正文与编译快照位于 `rules/`。牌数、购买时序、事件链和胜利条件由 V7.1 引擎回归保护。

| 维护项               | 入口                                                                              |
| -------------------- | --------------------------------------------------------------------------------- |
| 规则版本与拒绝提示   | `lib/game/registry.ts`、`lib/rules/scope.ts`、`app/api/lab/route.ts`              |
| 牌桌与公开市场       | `features/playtest`、`lib/game/market.ts`                                         |
| 暂停、恢复和保存重试 | `features/workspace/use-playtest-controller.ts`、`lib/playtest/run-game.ts`       |
| 统计及导出           | `features/reports`、`lib/reports`                                                 |
| 记录编解码和持久化   | `lib/records`、`db/lab.ts`、`db/lab-reader.ts`                                    |
| 漫画样式和占位图     | `app/styles`、`components/lab/critter-portrait.tsx`、`public/illustrations/seats` |

浏览器测试使用独立端口和会话，数据库迁移及 Vite 的 `persistState.path` 指向同一临时目录。合成测试数据、下载、截图、构建产物与缓存放在评审源代码包之外。

## DeepSeek 单步验收

用 `npm run local` 启动工作台后，在「牌桌与 AI」用已配置的官方 DeepSeek 座位点击「试出一张牌」。每次本机服务启动后最多发一次可能计费的请求，刷新页面也共用这一次。引擎只在固定 V7.1 样例中应用模型选中的合法购买动作，不开局、不写入对局记录。

## API 对战调用上限

开局时设定每局调用上限。对战、桌聊、总结和自动重试都共用该局额度，暂停恢复或补生成总结会沿用原上限。每次发送前先在本地数据库占用一格。取消、断线或未收到响应时可能已发出请求，因此占用的额度不会退回。若无法确认额度，工作台停止发送。单独点击「测试真实连接」属于对局以外的请求。
