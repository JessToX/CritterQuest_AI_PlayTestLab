# 第三方署名

[中文](THIRD_PARTY.md) · [English](THIRD_PARTY.en.md)

## 随源码提供

- `components/ui/` 中的 `button.tsx`、`checkbox.tsx`、`dialog.tsx`、`input.tsx`、`label.tsx`、`native-select.tsx`、`switch.tsx`、`tabs.tsx` 和 `textarea.tsx`，均可追溯到 shadcn/ui 的 Base UI 模板。候选配置指定 `base-nova`，此前逐文件核对了官方同名模板。保留 shadcn 的 MIT 声明。首次引入所用的上游提交仍未确认。现版下拉的固定来源见下。[上游许可](https://github.com/shadcn-ui/ui/blob/main/LICENSE.md) · [上游组件](https://github.com/shadcn-ui/ui/tree/main/apps/v4/registry/bases/base/ui) · [随附声明](licenses/shadcn-MIT.txt)
- `components/ui/native-select.tsx` 对齐到 shadcn 的固定 Base 模板。Base Nova 的 class 展开来自官方 registry。候选保留该模板的 Lucide ChevronDown 选项和现有本地 `cn` 别名。下拉仍使用原生控件和原插槽。[固定源码](https://github.com/shadcn-ui/ui/blob/f50887ae68d0fdcbfbe86b57be08af94a4c88a68/apps/v4/registry/bases/base/ui/native-select.tsx) · [同一提交的 MIT 声明](https://github.com/shadcn-ui/ui/blob/f50887ae68d0fdcbfbe86b57be08af94a4c88a68/LICENSE.md) · [Base Nova registry](https://ui.shadcn.com/r/styles/base-nova/native-select.json)
- `lib/utils.ts` 与 shadcn 官方旧版 Base helper 的整个文件在格式归一后相同，沿用 shadcn 的 MIT 声明。`app/globals.css` 导入随仓库分发的 shadcn Tailwind 样式，部分组件也使用 `@base-ui/react`。[固定 helper 源码](https://github.com/shadcn-ui/ui/blob/86d9b00084affa7010e6c7c7bd410ec62525caac/apps/v4/registry/bases/base/lib/utils.ts) · [同一提交的 MIT 声明](https://github.com/shadcn-ui/ui/blob/86d9b00084affa7010e6c7c7bd410ec62525caac/LICENSE.md)
- 工作台从 `lucide-react` 导入图标。随附的 1.31.0 声明包含 Lucide 的 ISC 条款和 Feather 派生图标的 MIT 条款与 Cole Bemis 署名。部分在用图标如 Check 和 Minus 在其派生清单内。[Lucide 上游](https://lucide.dev/license) · [随附完整声明](licenses/lucide-and-feather.txt)
- 中文字体 ZCOOL KuaiLe 的 TTF 与版权人和 SIL OFL 1.1 声明一起分发。[字体许可](../public/fonts/ZCOOLKuaiLe-OFL.txt) · [上游声明](https://github.com/google/fonts/blob/main/ofl/zcoolkuaile/OFL.txt)
- Geist 与 Geist Mono 经 Google Fonts 获取。两者的 SIL OFL 1.1 文本与署名一致，随附一份用于两族。源码包随附许可文本，构建可能另含 WOFF2。[字体许可](../public/fonts/licenses/Geist-OFL.txt) · [Geist 上游](https://github.com/google/fonts/blob/main/ofl/geist/OFL.txt) · [Geist Mono 上游](https://github.com/google/fonts/blob/main/ofl/geistmono/OFL.txt)

## shadcn 模板与样式出处

2026-11-20 对照了固定上游 Base 模板、官方 Base Nova registry 内容和本地首次引入版本。固定模板证明上游对应关系。现有记录缺少首次引入时使用的 shadcn CLI 版本与上游提交。以下短摘要为本次取得的 registry JSON 的 SHA-256 前 16 位。

- `components/ui/button.tsx`。Base UI 按钮、CVA 样式和插槽对应。项目导入本地 `cn`，并在本地首版之后加了 `data-variant`。 Registry 摘要 `9ba7e870178813f0`。[固定 Base 模板](https://github.com/shadcn-ui/ui/blob/f50887ae68d0fdcbfbe86b57be08af94a4c88a68/apps/v4/registry/bases/base/ui/button.tsx) · [Base Nova registry](https://ui.shadcn.com/r/styles/base-nova/button.json)
- `components/ui/checkbox.tsx`。Base UI 的 Root 和 Indicator 及样式对应。本地首版用 Lucide Check，后续增加 Minus 和不确定状态分支。 Registry 摘要 `e6df7b595f25a7ee`。[固定 Base 模板](https://github.com/shadcn-ui/ui/blob/f50887ae68d0fdcbfbe86b57be08af94a4c88a68/apps/v4/registry/bases/base/ui/checkbox.tsx) · [Base Nova registry](https://ui.shadcn.com/r/styles/base-nova/checkbox.json)
- `components/ui/dialog.tsx`。Base UI 的对话框组合及插槽对应，项目使用本地按钮、`cn` 和 Lucide X。相较本地首版，项目调整了弹窗动画样式，增加关闭按钮样式并将其无障碍标签改为中文。 Registry 摘要 `40fc321d25eb9590`。[固定 Base 模板](https://github.com/shadcn-ui/ui/blob/f50887ae68d0fdcbfbe86b57be08af94a4c88a68/apps/v4/registry/bases/base/ui/dialog.tsx) · [Base Nova registry](https://ui.shadcn.com/r/styles/base-nova/dialog.json)
- `components/ui/tabs.tsx`。Base UI Tabs 和 CVA 样式对应。项目使用本地 `cn`，本地首版之后开始显式传递 `orientation`。 Registry 摘要 `b4552a0329dd9a6e`。[固定 Base 模板](https://github.com/shadcn-ui/ui/blob/f50887ae68d0fdcbfbe86b57be08af94a4c88a68/apps/v4/registry/bases/base/ui/tabs.tsx) · [Base Nova registry](https://ui.shadcn.com/r/styles/base-nova/tabs.json)

- `app/vendor/shadcn-tailwind.css` 逐字节取自已锁定的 `shadcn@4.23.0` 官方 npm 包中的 `dist/tailwind.css`。SHA-256 为 `4c371f7a1ff5d219ae2f7ff28bd256b4346fd546fe46fbae22092e57db2f0fae`。随附 MIT 原文与该包许可及上游固定提交一致。[官方 npm 版本](https://registry.npmjs.org/shadcn/4.23.0) · [固定上游许可](https://github.com/shadcn-ui/ui/blob/f50887ae68d0fdcbfbe86b57be08af94a4c88a68/LICENSE.md) · [随附声明](licenses/shadcn-MIT.txt)

## 从 npm 安装

下表覆盖锁定的直接运行依赖。包内路径相对于各包根目录。开发及传递依赖以 `package-lock.json` 为准，许可全文见对应包或上游。源码 ZIP 未附齐这些依赖的全部许可正文。若制作单独构建发行物，请按实际随包源码、字体和图标核对完整声明。

| npm 包                     | 验证版本 | npm 包声明                                                                    | 包内声明文件           |
| -------------------------- | -------- | ----------------------------------------------------------------------------- | ---------------------- |
| `@base-ui/react`           | 1.7.0    | MIT                                                                           | `LICENSE`              |
| `class-variance-authority` | 0.7.1    | Apache-2.0                                                                    | `LICENSE`              |
| `clsx`                     | 2.1.1    | MIT                                                                           | `license`              |
| `docx`                     | 9.7.1    | MIT                                                                           | `LICENSE`              |
| `drizzle-orm`              | 0.45.2   | [Apache-2.0](https://github.com/drizzle-team/drizzle-orm/blob/0.45.2/LICENSE) | 包根目录未列出单独文件 |
| `fflate`                   | 0.8.3    | MIT                                                                           | `LICENSE`              |
| `lucide-react`             | 1.31.0   | ISC，含 Feather 的 MIT 声明                                                   | `LICENSE`              |
| `react`                    | 19.3.1   | MIT                                                                           | `LICENSE`              |
| `react-dom`                | 19.3.1   | MIT                                                                           | `LICENSE`              |
| `react-server-dom-webpack` | 19.3.1   | MIT                                                                           | `LICENSE`              |
| `tailwind-merge`           | 3.6.0    | MIT                                                                           | `LICENSE.md`           |
| `tw-animate-css`           | 1.4.0    | MIT                                                                           | `LICENSE`              |
| `undici`                   | 7.30.2   | MIT                                                                           | `LICENSE`              |
| `vinext`                   | 1.4.6    | MIT                                                                           | `LICENSE`              |
