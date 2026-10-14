import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from '@/App.vue'
import { router } from '@/ui/router'
import { installModules } from '@/core/module-registry'
import { registerBuiltinModules } from '@/modules'
import { openDatabase } from '@/core/db/database'
import { switchToMemoryBackend } from '@/core/db/repository'
import { usePlatformStore } from '@/core/stores/platform'
import { bus } from '@/core/event-bus'
import { startVitals } from '@/core/perf/vitals'
import '@/styles/main.css'
import '@/styles/motion.css'

async function bootstrap() {
  const app = createApp(App)
  app.use(createPinia())

  const platform = usePlatformStore()
  bus.on('toast', ({ message, tone }) => platform.pushToast(message, tone ?? 'info'))

  // 1. 本地数据仓：不可用时降级为内存态，核心流程仍可用
  const dbResult = await openDatabase()
  if (dbResult.status === 'unavailable') {
    switchToMemoryBackend()
    console.warn('[db] IndexedDB 不可用，已降级内存态：', dbResult.message)
  }
  platform.setDbStatus(dbResult.status, dbResult.message)

  // 2. 注册并安装模块：核心路由之外的一切都由模块注入
  // 注意：必须先装模块再 use(router)，否则初始导航会因路由尚未注册而失败
  registerBuiltinModules()
  await installModules(router)

  // 兜底路由放在最后，避免抢占模块路由
  router.addRoute({
    path: '/:pathMatch(.*)*',
    name: 'not-found',
    meta: { title: '页面不存在' },
    component: () => import('@/ui/views/NotFoundView.vue'),
  })

  app.config.errorHandler = (err) => {
    console.error('[app]', err)
    platform.pushToast('出错了，但该问题已被隔离', 'error')
  }

  app.use(router)
  app.mount('#app')
  startVitals()
}

void bootstrap()
