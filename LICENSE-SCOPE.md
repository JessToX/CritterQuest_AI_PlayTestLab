# 许可范围

## 软件和界面

[MIT](LICENSE) 适用于权利方自有的工作台代码和界面，包括引擎实现、存取及导出、模拟与模型接口、交互组件、项目样式和合成测试代码。已确认归属的界面几何资产为 `public/illustrations/seats/seat-{0,1,2,3}-{ready,paused}.png` 与 `public/favicon.png`，采用同一 MIT 许可。版权声明为 `Copyright (c) 2026 JessToX`。

## 游戏内容

任何人都可出于非商业目的使用、复制、分享和改编 JessToX 拥有权利的 V7.1 原创游戏内容。商用如依法需要授权，须另获 JessToX 许可。游戏内容授权适用于下列文件里的原创表达及其副本。软件和 UI 实现按 MIT 授权，包括商用。抽象概念、玩法方法及纯功能性规则按适用法律处理。[游戏内容授权正文](GAME-CONTENT-LICENSE.md)

| 文件或内容                                                                                                                                         | 游戏内容与软件实现的范围                                                                                                                        |
| -------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| [rules/v71-final-text.ts](rules/v71-final-text.ts)                                                                                                 | `V71_FINAL_DOCUMENT` 内的正式玩家规则第 01–13 节、制作清单第 14–16 节及其中的牌组、卡牌与订单表达属于游戏内容。导出语句是软件接口。             |
| [rules/compiled/final-v7.1.json](rules/compiled/final-v7.1.json)                                                                                   | `text`、`config` 中的游戏表达及规则修订说明属于游戏内容范围。ID、哈希和时间戳用作版本识别。                                                     |
| [lib/game/engines/v71/cards.ts](lib/game/engines/v71/cards.ts)                                                                                     | `V71_CONFIG`、`createOrders` 中的订单组合和 `createMainCards` 中的成套主牌定义归在游戏数据侧。生成 ID、构造对象、洗牌、抽牌和补位属于引擎实现。 |
| [lib/game/engines/v71/setup.ts](lib/game/engines/v71/setup.ts)、[lib/game/market.ts](lib/game/market.ts)、[lib/game/labels.ts](lib/game/labels.ts) | 固定的开局配置、食物与事件牌定义、牌名与对应游戏文本、价格配置归在游戏数据或表达侧。校验、状态初始化、查询与标签渲染函数属于软件实现。          |
| [lib/game/registry.ts](lib/game/registry.ts)、[lib/rules/versions.ts](lib/rules/versions.ts)                                                       | `ruleSummary`、`V71_IMPLEMENTATION_NOTES` 和 `BASE_RULE` 所携带的规则正文及修订说明属于游戏内容。登记、查找、导入和呈现属于软件实现。           |
| 其他游戏表达的引用                                                                                                                                 | UI、引擎、提示词、测试、存档快照或导出中对上述文字、成套配置和牌组的原样引用或重现，沿用原内容范围。运行时渲染、校验与序列化逻辑属于软件。      |

原始 Word/PDF、旧规则、原席位插画及历史试玩材料保存在内部。当前包只收录正式 V7.1 及运行所需的相关源文件。

## 第三方

第三方内容保留各自声明。模板改动中属于项目方的原创部分适用项目软件许可。模板、字体、图标及依赖的上游部分见[第三方署名](docs/THIRD_PARTY.md)。
