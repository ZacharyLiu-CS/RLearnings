import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import { usePlatformStore } from '@/core/stores/platform'

/**
 * 核心路由只放骨架；业务路由全部由模块在启动阶段动态注入（路由级代码分割）。
 */
const coreRoutes: RouteRecordRaw[] = [
  {
    path: '/',
    redirect: () => {
      const platform = usePlatformStore()
      return platform.firstRouteName ? { name: platform.firstRouteName } : { name: 'words-library' }
    },
  },
]

export const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: coreRoutes,
  scrollBehavior: () => ({ top: 0 }),
})

router.onError((error) => {
  console.error('[router]', error)
})
