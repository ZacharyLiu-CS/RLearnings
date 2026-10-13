import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import type { Router } from 'vue-router'
import { installModules, registerModule, registeredModules } from '@/core/module-registry'
import { usePlatformStore } from '@/core/stores/platform'
import type { LearningModule } from '@/core/types'

function createRouterStub(): { router: Router; addRoute: ReturnType<typeof vi.fn> } {
  const addRoute = vi.fn()
  return { router: { addRoute } as unknown as Router, addRoute }
}

describe('模块注册器', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('重复注册同一模块会被忽略', () => {
    const module: LearningModule = { id: 'dup', title: 'D', icon: 'D', version: '1', install: () => undefined }
    registerModule(module)
    registerModule(module)
    expect(registeredModules().filter((m) => m.id === 'dup')).toHaveLength(1)
  })

  it('安装后路由与菜单由模块自行注入，核心不感知业务', async () => {
    const { router, addRoute } = createRouterStub()
    registerModule({
      id: 'ok',
      title: '正常模块',
      icon: '✅',
      version: '1.0.0',
      install(ctx) {
        ctx.addRoutes([{ path: '/ok', name: 'ok', component: { template: '' } }])
        ctx.registerMenu({ id: 'ok', title: '正常', icon: '✅', routeName: 'ok', order: 1 })
      },
    })

    await installModules(router)

    expect(addRoute).toHaveBeenCalled()
    const platform = usePlatformStore()
    expect(platform.orderedMenu.some((entry) => entry.routeName === 'ok')).toBe(true)
    expect(platform.modules.find((m) => m.id === 'ok')?.status).toBe('ready')
  })

  it('单模块安装失败只影响自身，不阻断其他模块', async () => {
    const { router } = createRouterStub()
    registerModule({
      id: 'broken',
      title: '异常模块',
      icon: '💥',
      version: '1.0.0',
      install() {
        throw new Error('install failed')
      },
    })

    await expect(installModules(router)).resolves.toBeUndefined()

    const platform = usePlatformStore()
    expect(platform.modules.find((m) => m.id === 'broken')?.status).toBe('error')
    expect(platform.readyModules.length).toBeGreaterThan(0)
  })
})
