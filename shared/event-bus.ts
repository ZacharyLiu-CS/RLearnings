/**
 * 模块间 / 页面间通信总线（跨平台共享）。
 * 单个订阅者抛错不影响其他订阅者与发布者。
 */
import type { ItemSourceModule, LearningItem, Rating } from './types'

export interface PlatformEvents {
  'item:added': { items: LearningItem[]; source: ItemSourceModule }
  'item:updated': { id: string }
  'item:removed': { ids: string[] }
  'article:word-lookup': { ru: string; zh?: string; refId?: string }
  'review:graded': { id: string; rating: Rating }
  'review:finished': { count: number }
  'module:error': { moduleId: string; message: string }
  toast: { message: string; tone?: 'info' | 'success' | 'warn' | 'error' }
}

type Handler<K extends keyof PlatformEvents> = (payload: PlatformEvents[K]) => void

export class EventBus {
  private handlers = new Map<keyof PlatformEvents, Set<Handler<never>>>()

  on<K extends keyof PlatformEvents>(event: K, handler: Handler<K>): () => void {
    let set = this.handlers.get(event)
    if (!set) {
      set = new Set()
      this.handlers.set(event, set)
    }
    set.add(handler as Handler<never>)
    return () => this.off(event, handler)
  }

  once<K extends keyof PlatformEvents>(event: K, handler: Handler<K>): () => void {
    const off = this.on(event, (payload) => {
      off()
      handler(payload)
    })
    return off
  }

  off<K extends keyof PlatformEvents>(event: K, handler: Handler<K>): void {
    this.handlers.get(event)?.delete(handler as Handler<never>)
  }

  emit<K extends keyof PlatformEvents>(event: K, payload: PlatformEvents[K]): void {
    const set = this.handlers.get(event)
    if (!set?.size) return
    for (const handler of [...set]) {
      try {
        ;(handler as Handler<K>)(payload)
      } catch (err) {
        console.error(`[bus] handler failed for "${String(event)}"`, err)
      }
    }
  }
}

export const bus = new EventBus()
