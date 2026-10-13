/**
 * 平台核心契约（Web 端）：数据模型与仓储接口复用跨平台 shared 层，
 * 这里只定义与「模块插件」相关的平台侧类型。
 */
import type { RouteRecordRaw, Router } from 'vue-router'
import type { EventBus } from '../../shared/event-bus'
import type { ItemRepository } from '../../shared/types'
import type { SrsScheduler } from '../../shared/srs'

export * from '../../shared/types'

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
