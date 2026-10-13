/**
 * 模块注册器：平台核心不认识任何业务模块。
 * 新模块只需实现 LearningModule 契约并在 modules/index.ts 注册一行即可上线。
 */
import type { RouteRecordRaw, Router } from 'vue-router'
import type { LearningModule, MenuEntry, ModuleContext, RegisteredModule } from '@/core/types'
import { bus } from '@/core/event-bus'
import { repository } from '@/core/db/repository'
import { srs } from '@/core/srs'
import { usePlatformStore } from '@/core/stores/platform'

const modules: LearningModule[] = []

/** 注册模块（不立即安装，安装发生在应用启动阶段） */
export function registerModule(module: LearningModule): void {
  if (modules.some((m) => m.id === module.id)) {
    console.warn(`[registry] 模块 ${module.id} 已注册，忽略重复注册`)
    return
  }
  modules.push(module)
}

export function registeredModules(): readonly LearningModule[] {
  return modules
}

function createContext(module: LearningModule, router: Router): ModuleContext {
  const platform = usePlatformStore()
  return {
    moduleId: module.id,
    router,
    bus,
    items: repository,
    srs,
    addRoutes(routes: RouteRecordRaw[]) {
      for (const route of routes) router.addRoute(route)
    },
    registerMenu(entry: MenuEntry) {
      platform.registerMenu(entry)
    },
  }
}

/**
 * 逐个安装模块：单模块安装失败只标记自身为 error，不影响其他模块与核心启动。
 */
export async function installModules(router: Router): Promise<void> {
  const platform = usePlatformStore()
  for (const module of modules) {
    const record: RegisteredModule = { ...module, status: 'idle' }
    platform.addModule(record)
    try {
      await module.install(createContext(module, router))
      record.status = 'ready'
      platform.setModuleStatus(module.id, 'ready')
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      record.status = 'error'
      platform.setModuleStatus(module.id, 'error', message)
      bus.emit('module:error', { moduleId: module.id, message })
      console.error(`[registry] 模块 ${module.id} 安装失败`, err)
    }
  }
}
