/**
 * 平台级状态：菜单（由模块注册）、模块健康度、存储后端状态、全局 Toast。
 */
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import type { MenuEntry, RegisteredModule } from '@/core/types'
import type { DbStatus } from '@/core/db/database'
import { createId } from '@/core/utils/id'

export interface Toast {
  id: string
  message: string
  tone: 'info' | 'success' | 'warn' | 'error'
}

export const usePlatformStore = defineStore('platform', () => {
  const menu = ref<MenuEntry[]>([])
  const modules = ref<RegisteredModule[]>([])
  const dbStatus = ref<DbStatus>('pending')
  const dbMessage = ref<string | undefined>()
  const toasts = ref<Toast[]>([])
  const timers = new Map<string, ReturnType<typeof setTimeout>>()

  const orderedMenu = computed(() =>
    [...menu.value].sort((a, b) => (a.order ?? 99) - (b.order ?? 99)),
  )
  const readyModules = computed(() => modules.value.filter((m) => m.status === 'ready'))
  const firstRouteName = computed(() => orderedMenu.value[0]?.routeName)

  function registerMenu(entry: MenuEntry) {
    if (menu.value.some((item) => item.id === entry.id)) return
    menu.value.push(entry)
  }

  function setModuleStatus(moduleId: string, status: RegisteredModule['status'], error?: string) {
    const target = modules.value.find((m) => m.id === moduleId)
    if (target) {
      target.status = status
      target.error = error
    }
  }

  function addModule(module: RegisteredModule) {
    if (!modules.value.some((m) => m.id === module.id)) modules.value.push(module)
  }

  function pushToast(message: string, tone: Toast['tone'] = 'info', duration = 2600): string {
    const id = createId('ts')
    toasts.value.push({ id, message, tone })
    if (duration > 0) {
      const timer = setTimeout(() => dismissToast(id), duration)
      timers.set(id, timer)
    }
    return id
  }

  function dismissToast(id: string) {
    const timer = timers.get(id)
    if (timer) {
      clearTimeout(timer)
      timers.delete(id)
    }
    toasts.value = toasts.value.filter((toast) => toast.id !== id)
  }

  function setDbStatus(status: DbStatus, message?: string) {
    dbStatus.value = status
    dbMessage.value = message
  }

  return {
    menu,
    modules,
    dbStatus,
    dbMessage,
    toasts,
    orderedMenu,
    readyModules,
    firstRouteName,
    registerMenu,
    setModuleStatus,
    addModule,
    pushToast,
    dismissToast,
    setDbStatus,
  }
})
