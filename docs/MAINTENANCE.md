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

## 回归验证入口

| 修改对象               | 从哪里开始验证                                                                                                                                                                                                                                                               |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 供应商请求及配置       | `tests/agents/providers.test.ts` 在内存中捕获请求，核对三种方言、指令、参数和返回格式。`model-errors.test.ts` 核对取消、超时与供应商错误。普通路由的来源与任务校验顺序在 `route-contract.test.ts`。                                                                          |
| 历史存档、分页与回放   | `tests/playtest/resume.test.ts` 锁定首次保存前旧字段的处理和原件不变。`tests/client/records.test.ts`、`tests/records/codec.test.ts` 和 `tests/db/lab-reader.test.ts` 分别覆盖客户端翻页、编解码和实际 SQLite 分片查询。修改页大小要同时检查 HTTP 的 hasMore 与 unsupported。 |
| 保存、暂停、终止与重试 | `tests/workspace/playtest-controller.test.ts` 经控制器和实际记录 hook 验证待保存快照、并发重试及终止所有权；批次、总结和单局推进的测试在 `tests/playtest/`。                                                                                                                 |
| 席位和展示             | 在隔离浏览器中以 B/D 两席开免费局，暂停、修改新局头像偏好、刷新并继续；完局后关闭浏览器，重开同一数据库回看。旧局应保留原字段并显示相应席位；另核对提前终止与正常完局的待命图和文案。                                                                                        |

全量入口仍是 `npm ci` 和 `npm run check`。做本机生产构建验收时可使用以下命令，将两条命令中的数据库目录设为同一个新的绝对路径，端口换成当前未使用的回环端口：

```sh
npm run db:local -- --persist-to "$QA_DB"
npm start -- --port "$QA_PORT" --inspector-port 0 --persist-to "$QA_DB"
```

用空浏览器配置和合成对局执行免费模拟。需要核对供应商线协议时使用测试替身；本机真实供应商单步验收是单独的入口。
