/**
 * 平台核心契约：内容无关的统一数据模型 + 模块插件接口。
 * 核心层不认识任何具体业务模块，模块只依赖这里的契约。
 */
import type { RouteRecordRaw, Router } from 'vue-router'
import type { EventBus } from '@/core/event-bus'
import type { ItemRepository } from '@/core/db/repository'
import type { SrsScheduler } from '@/core/srs'

/** 学习内容类型：M1 词条 / M2 段落 / M4 句子，均可复用同一模型 */
export type LearningItemType = 'word' | 'sentence' | 'collocation'

/** 内容来源（用于来源追踪与回流统计） */
export type ItemSourceModule = 'manual' | 'ocr' | 'reading' | 'chat' | 'shadowing'

export type SrsStatus = 'new' | 'learning' | 'reviewing' | 'mastered'

export type Rating = 'known' | 'fuzzy' | 'unknown'

export interface SrsState {
  /** 0-4，对应间隔 1/3/7/14/30 天 */
  box: number
  /** 下次复习时间 ISO */
  nextReview: string
  status: SrsStatus
}

export interface ItemSource {
  module: ItemSourceModule
  /** 关联的文章 / 会话 / 跟读记录 ID */
  refId?: string
}

export interface LearningItem {
  id: string
  type: LearningItemType
  ru: string
  stress?: string
  pos?: string
  zh?: string
  forms?: string
  example?: string
  note?: string
  tags: string[]
  source: ItemSource
  srs: SrsState
  starred: boolean
  createdAt: string
}

export interface ReviewLog {
  id: string
  itemId: string
  at: string
  rating: Rating
  /** 复习后所处的 box，便于统计曲线 */
  box: number
}

/** 模块向平台注册的菜单入口 */
export interface MenuEntry {
  id: string
  title: string
  icon: string
  /** vue-router 的 name */
  routeName: string
  order?: number
}

/** 安装模块时拿到的上下文：能力全部由核心层下发 */
export interface ModuleContext {
  readonly moduleId: string
  readonly router: Router
  readonly bus: EventBus
  readonly items: ItemRepository
  readonly srs: SrsScheduler
  addRoutes(routes: RouteRecordRaw[]): void
  registerMenu(entry: MenuEntry): void
}

/** 功能模块契约：实现 install(ctx) 即可接入平台 */
export interface LearningModule {
  id: string
  title: string
  icon: string
  version: string
  description?: string
  install(ctx: ModuleContext): void | Promise<void>
}

export interface RegisteredModule extends LearningModule {
  status: 'idle' | 'ready' | 'error'
  error?: string
}
