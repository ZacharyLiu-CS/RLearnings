/**
 * M1 单词记忆模块：以插件形式挂载到平台。
 * 核心代码不认识本模块；本模块也不认识其他模块，只通过事件总线协作。
 */
import type { LearningModule, MenuEntry } from '@/core/types'
import { useWordsStore } from './store'

const routes = [
  {
    path: '/words/library',
    name: 'words-library',
    meta: { title: '词库' },
    // 路由级代码分割：首屏只加载当前视图
    component: () => import('./views/WordsLibraryView.vue'),
  },
  {
    path: '/words/add',
    name: 'words-add',
    meta: { title: '录入' },
    component: () => import('./views/WordsAddView.vue'),
  },
  {
    path: '/words/review',
    name: 'words-review',
    meta: { title: '复习' },
    component: () => import('./views/WordsReviewView.vue'),
  },
  {
    path: '/words/stats',
    name: 'words-stats',
    meta: { title: '统计' },
    component: () => import('./views/WordsStatsView.vue'),
  },
  {
    path: '/words/settings',
    name: 'words-settings',
    meta: { title: 'AI 设置' },
    component: () => import('./views/WordsSettingsView.vue'),
  },
]

const menu: MenuEntry[] = [
  { id: 'words-review', title: '复习', icon: 'bolt', routeName: 'words-review', order: 1 },
  { id: 'words-library', title: '词库', icon: 'library', routeName: 'words-library', order: 2 },
  { id: 'words-add', title: '录入', icon: 'plus', routeName: 'words-add', order: 3 },
  { id: 'words-stats', title: '统计', icon: 'chart', routeName: 'words-stats', order: 4 },
  { id: 'words-settings', title: 'AI', icon: 'settings', routeName: 'words-settings', order: 5 },
]

export const wordsModule: LearningModule = {
  id: 'words',
  title: '单词记忆',
  icon: 'library',
  version: '1.1.0',
  description: 'OCR / AI 补全录入 + SRS 复习 + 统计',

  install(ctx) {
    ctx.addRoutes(routes)
    for (const entry of menu) ctx.registerMenu(entry)

    // 跨模块回流契约：M2 阅读查词 / M3 对话生词 / M4 跟读难点只需发事件，
    // 无需了解本模块的实现细节即可汇入统一复习体系。
    ctx.bus.on('article:word-lookup', async ({ ru, zh, refId }) => {
      const store = useWordsStore()
      await store.addItems([{ ru, zh }], 'reading', refId)
    })
  },
}
