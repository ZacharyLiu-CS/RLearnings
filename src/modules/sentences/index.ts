/**
 * Demo 模块（句子收藏）：用于验证平台拓展性。
 * 只通过 ModuleContext 拿能力，不给核心层加一行代码即可上线。
 */
import type { LearningModule } from '@/core/types'

export const sentencesModule: LearningModule = {
  id: 'sentences',
  title: '句子收藏',
  icon: '🧩',
  version: '0.1.0',
  description: '拓展性验证模块：句子同样进入统一 SRS 调度',

  install(ctx) {
    ctx.addRoutes([
      {
        path: '/sentences',
        name: 'sentences',
        meta: { title: '句子收藏 · 拓展性 Demo' },
        component: () => import('./views/SentencesView.vue'),
      },
    ])
    ctx.registerMenu({
      id: 'sentences',
      title: '句子 Demo',
      icon: '🧩',
      routeName: 'sentences',
      order: 9,
    })
  },
}
