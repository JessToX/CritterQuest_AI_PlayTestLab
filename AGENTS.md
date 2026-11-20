# V7.1 候选维护约定

本目录只运行 V7.1 正式版。先读[架构说明](docs/ARCHITECTURE.md)与[维护指南](docs/MAINTENANCE.md)。

- `app` 处理路由和 HTTP 校验。工作台状态在 `features/workspace`，其他 feature 保持独立。
- `lib/game/engine.ts` 是引擎入口。正式规则与引擎登记在 `registry.ts`，市场查询在 `market.ts`。引擎内部模块只从 `lib/game` 内引用。
- `lib/playtest` 接收模型、保存和更新回调。浏览器 I/O 在 `lib/client`，本地 D1 在 `db`。
- 保留规则时序、随机调用、事件顺序、可见信息、报告及存档语义。存档版本不符时明确拒绝。修改数据库结构请使用新迁移。
- 用 `npm ci` 安装并执行 `npm run check`。界面交互变动需用隔离浏览器存储和合成记录验证。免费模拟无需真实供应商。
