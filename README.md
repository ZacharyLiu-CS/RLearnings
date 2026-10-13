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
src/core     平台核心（不认识任何业务模块）
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

## 测试与 CI

```bash
npm run test          # Vitest 单测（27 个用例）
npm run typecheck     # vue-tsc 类型检查
npm run build         # 类型检查 + 生产构建
npm run check:budget  # 首屏 gzip 体积预算（默认 ≤ 200KB，超出即失败）
```

覆盖范围：SRS 调度、事件总线（订阅者异常隔离）、数据仓（去重 / 筛选 / 到期队列 / 统计 / 内存降级）、备份导入导出、模块注册器（路由菜单注入 + 单模块失败隔离）、单词模块 store（录入去重 / 评分流转 / 打卡统计）。

`.github/workflows/ci.yml` 在 push 与 PR 时执行：安装依赖 → 类型检查 → 单测 → 构建 → 首屏性能预算卡点，任一失败即阻断合并。

## 验证情况（V1.0 冒烟）

已在无头 Chrome 跑通：模块注册与菜单、手动/批量录入、1 万条数据虚拟滚动（DOM 15 行）、搜索过滤、键盘复习（空格翻面 / 1·2·3 评分）、统计指标、Demo 模块独立入库、IndexedDB 持久化（10001 条）、OCR 图片识别 → 校对 → 入库（无 console 报错）。
