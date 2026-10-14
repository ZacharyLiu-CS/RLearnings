# Русский · 俄语学习平台

模块化俄语学习平台（V1.0 = 平台骨架 + M1 单词记忆）。架构上为 M2 文章阅读 / M3 AI 对话 / M4 AI 跟读预留了插件式接入能力，共享同一套「生词本 + SRS 复习」数据层。

## 快速开始

```bash
npm install      # 安装依赖并同步 tesseract wasm core 到 public/
npm run dev      # http://localhost:5173
npm run build    # 类型检查 + 生产构建
npm run preview
```

> OCR 摄像头需要 HTTPS 或 localhost；`npm run dev` 已满足。首次 OCR 会下载俄语语言包（约 10MB），之后由浏览器缓存。

## 架构

```
shared/      跨平台共享核心（纯 TS，无 DOM / 无 Vue / 无 wx 依赖）
  types.ts           LearningItem / ItemRepository 契约
  srs.ts             统一 SRS 调度器（Web 与小程序共用）
  event-bus.ts       事件总线
  item.ts            条目工厂 / 查重 / 筛选匹配 / 批量与 CSV 解析
src/core     平台核心（Web 端，不认识任何业务模块）
  types.ts           LearningItem / LearningModule 契约
  module-registry.ts 模块注册器（插件式挂载、单模块失败隔离）
  event-bus.ts       模块间事件总线（item:added / article:word-lookup ...）
  srs.ts             统一 SRS 调度器（间隔 1/3/7/14/30 天）
  db/                IndexedDB（Dexie）仓储 + 内存降级 + 导出导入
  stores/platform.ts 菜单 / 模块健康度 / Toast
src/ui        通用组件：路由、错误边界、虚拟滚动、骨架屏、Toast
src/modules   业务模块（插件）
  words/      M1 单词记忆：录入 / 词库 / 复习 / 统计
  sentences/  拓展性验证 Demo（句子收藏，未改动任何核心代码）
miniprogram/  原生微信小程序（同一套数据模型与 SRS 调度）
  shared/     由 shared/ 同步而来（npm run sync:shared，CI 校验一致性）
  core/       Storage 数据仓 / OCR 服务 / 备份（剪贴板导入导出）
  pages/      复习 · 词库 · 录入 · 统计
  components/ item-row 词条行组件
```

数据流：模块 → 事件总线 → 统一数据仓（LearningItem）→ 统一 SRS 调度 → 复习入口。因此 M2 查词、M3 对话生词、M4 跟读难点词只要 `bus.emit('article:word-lookup', ...)` 就会自动回流到词库复习（M1 已内置该订阅）。

## 接入新模块

1. 新建 `src/modules/<name>/index.ts`，实现 `LearningModule` 契约：`install(ctx)` 中 `ctx.addRoutes()` 注册路由、`ctx.registerMenu()` 注册入口；
2. 在 `src/modules/index.ts` 加一行 `registerModule(xxxModule)`；
3. 完成。核心代码零改动，模块安装失败只影响自身（错误边界 + 重载入口）。

数据统一通过 `ctx.items`（`LearningItem` 仓储）读写，`type` 字段区分 word / sentence / collocation，自动进入统一复习调度。

## 已落地的性能与稳定性策略

- 路由级代码分割 + 模块懒加载：首屏 JS ≈ 82KB gzip（预算 200KB）；OCR（含 wasm/worker）独立分包，使用时才加载。
- 词库虚拟滚动：1 万条数据仅渲染约 15 行 DOM，滚动走 transform。
- OCR 全程在 Web Worker（预处理 2x 放大 + 灰度 + Otsu 二值化 + Tesseract），主线程零阻塞；Worker 空闲 45s 回收。
- 乐观更新：评分、收藏、删除先更新界面再后台落库，失败自动回滚并提示。
- 稳定性：模块级错误边界、IndexedDB 不可用时降级内存态并提示导出、导出 JSON/CSV 兜底、Web Vitals（LCP/INP/CLS）采集。

## 视觉与交互风格（瑞士风格）

- 字体：Helvetica Neue / 系统无衬线；俄文用衬线体区分语种
- 色彩：纸白 `#fff` + 墨黑 `#111` + **单一强调红** `#d4321f`（主按钮、激活态、危险操作），不使用渐变与阴影
- 排版：严格栅格、发丝级分隔线、极小圆角（2–4px）、微标签全大写加字距（`MODULES` / `API KEY`）
- 图标：全站统一线性图标（1.6 描边，24 网格），**不使用 emoji**

## 录入流程（AI 优先）

1. **拍照 OCR**（默认入口）：拍照 / 选图 → 识别 → 校对列表（低置信度行标黄）→ 可选「AI 补全选中项」→ 入库
2. **手动录入**：只填俄语单词（支持多个，换行或逗号分隔）→ 模型自动补全释义 / 词性 / 重音 / 变位 / 例句 / 标签 → 预览可编辑 → 入库；离线可用「仅存原文」兜底
3. **批量粘贴**：`ru - zh` / `ru = zh` / `ru, zh` / `ru<Tab>zh` 四种分隔

## 动效规范（对齐 Apple HIG）

统一定义在 `src/styles/motion.css`（Web）与 `miniprogram/app.wxss`（小程序），两端同一套 token：

| Token | 值 | 用途 |
|---|---|---|
| `--dur-1 / 2 / 3 / 4` | 120 / 200 / 320 / 480ms | 微交互 → 元素 → 卡片 → 页面级 |
| `--ease-out` | `cubic-bezier(0.16, 1, 0.3, 1)` | **进入**：先快后缓（默认曲线） |
| `--ease-in` | `cubic-bezier(0.4, 0, 1, 1)` | **退出**：先缓后快 |
| `--ease-in-out` | `cubic-bezier(0.4, 0, 0.2, 1)` | 对称位移（卡片翻面） |
| `--spring` | `cubic-bezier(0.34, 1.56, 0.64, 1)` | 反馈类：轻微回弹（数字切换、满环脉冲、Toast） |

文字特效：`TextReveal.vue`
- **ink 水墨晕染**：径向遮罩自笔画中心扩散（`mask-size` 0% → 320%）+ 模糊消散（8px → 0）+ 轻微上浮，逐字/逐词错峰 34ms
- **rise 上浮淡入**：释义、例句等次要文本的轻量版本

落地位置：复习卡俄文/释义、满环「满环达成」文案、环心数字切换、卡片切换、路由页面切换、Toast、列表首屏、按钮按压。全部遵循 `prefers-reduced-motion`（跟随系统「减弱动态效果」自动关闭动画）。

小程序端因不支持 mask 动画，晕染降级为「模糊消散 + 上浮」，观感一致；动画重播通过 a/b 类名交替或 `tick` 计数器触发。

## 复习圆环与满环奖励（Apple 运动圆环风格）

- **复习页**：圆环表示本组进度，环心显示「剩余张数 → ✓ 满环」；每评一张环就前进一格（`stroke-dashoffset` 过渡，走合成层）
- **满环瞬间**：环切换为绿色渐变 + 一次缩放脉冲 + 10 粒子迸发；小程序端额外触发一次重震动反馈
- **奖励卡片**：满环达成 / 本组张数 / 连续打卡天数，并给出「再来一组 / 回到词库」
- **统计页**：Apple 式同心三环 —— 今日复习（目标 20 张）/ 连续打卡（7 天）/ 掌握率，环心显示今日完成数

实现：Web 端 `RingProgress.vue`（SVG 渐变环，支持同心多环）；小程序端 `components/review-ring`（canvas 2d，逐帧缓动，兼容各端 webview）。

## AI 配置（目前仅 DeepSeek）

在「AI」页填写 **API Key / 接口地址 / 模型** 即可，配置只保存在本机（Web：localStorage；小程序：wx.Storage），不写入备份、不上传服务端。

| 模型 ID | 说明 |
|---|---|
| `deepseek-flash` | DeepSeek-V4.1-Flash，默认推荐 |
| `deepseek-v4-pro` | DeepSeek-V4-Pro，更强 |
| 自定义 | 手填模型 ID（服务商升级后可直接填新模型） |

本地联调用的测试 Key 放在 `tmp/key`（已在 `.gitignore` 中，不会提交）。真机使用小程序时，需把 `https://api.deepseek.com` 加入小程序后台的 **request 合法域名**（开发阶段可在开发者工具勾选「不校验合法域名」）。

## 小程序端（原生）怎么用

> 发布上线请看 **[docs/小程序发布指南.md](./docs/小程序发布指南.md)**（AppID、ICP 备案、服务器域名、隐私保护指引、提审材料与常见驳回对策）。

1. 打开 **微信开发者工具** → 导入项目 → 目录选 `miniprogram/`；
2. 把 `miniprogram/project.config.json` 里的 `appid` 换成你自己的小程序 AppID（现在是 `touristappid` 游客模式）；
3. 勾选「使用 npm 模块 / TypeScript 编译」无需额外操作，`project.config.json` 已开启 `useCompilerPlugins: ["typescript"]`；
4. 点击编译即可在模拟器运行；真机调试用开发者工具「预览」。

能力差异（相对 Web 端）：

| 能力 | Web | 小程序 |
|---|---|---|
| 存储 | IndexedDB（Dexie），万级 | wx.Storage（索引 + 分条正文，上限 10MB） |
| OCR | 前端 Tesseract.js（Worker + WASM） | 拍照/选图 → `wx.uploadFile` 到服务端接口（在 `miniprogram/config.ts` 配 `ocrEndpoint`；未配置时降级手动/批量录入） |
| 复习操作 | 键盘空格翻面、1/2/3 评分 | 点击卡片翻面 + 三档按钮（小程序无键盘事件） |
| 导出导入 | 下载 JSON/CSV 文件 | 复制到剪贴板 / 从剪贴板导入（格式与 Web 端兼容） |
| 长列表 | DOM 虚拟滚动 | 窗口化渲染（只反序列化视口内条目） |

两端共用 `shared/` 的数据模型、查重规则、SRS 调度与统计口径，因此复习进度口径一致；`npm run sync:shared` 负责同步，CI 会校验不漂移。

## 测试与 CI

```bash
npm run test           # Vitest 单测（42 个用例，含小程序数据层与 AI 解析）
npm run typecheck      # Web 端 vue-tsc 类型检查
npm run typecheck:mp   # 小程序端 tsc 类型检查
npm run build          # Web：类型检查 + 生产构建
npm run check:budget   # 首屏 gzip 体积预算（默认 ≤ 200KB，超出即失败）
npm run sync:shared    # 把 shared/ 同步到 miniprogram/shared/
```

覆盖范围：SRS 调度、事件总线（订阅者异常隔离）、Web 数据仓（去重 / 筛选 / 到期队列 / 统计 / 内存降级）、小程序数据仓（去重 / 筛选 / 索引 / 到期队列 / 正文兜底 / 清空）、AI 层（URL 拼接 / 请求体 / JSON 提取 / 宽容解析 / 错误映射）、备份导入导出、模块注册器（路由菜单注入 + 单模块失败隔离）、单词模块 store（录入去重 / 响应式代理写入 / 评分流转 / 打卡统计）。

`.github/workflows/ci.yml` 在 push 与 PR 时并行执行两个任务：

- **Web 端**：安装依赖 → 类型检查 → 单测 → 构建 → 首屏性能预算卡点；
- **小程序端**：安装依赖 → `typecheck:mp` → `sync:shared` + `git diff --exit-code` 校验共享逻辑不漂移。

任一失败即阻断合并。

## 验证情况（V1.0 冒烟）

已在无头 Chrome 跑通：模块注册与菜单、手动/批量录入、1 万条数据虚拟滚动（DOM 15 行）、搜索过滤、键盘复习（空格翻面 / 1·2·3 评分）、统计指标、Demo 模块独立入库、IndexedDB 持久化（10001 条）、OCR 图片识别 → 校对 → 入库（无 console 报错）。
