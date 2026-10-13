/**
 * 模块间通信总线：模块之间不直接依赖，只通过事件交互。
 * 单个订阅者抛错不会影响其他订阅者与发布者。
 */
import type { ItemSourceModule, LearningItem, Rating } from '@/core/types'

export interface PlatformEvents {
  /** 新内容入库（M1 录入 / M2 查词 / M3 对话生词 / M4 难点词 都会发） */
  'item:added': { items: LearningItem[]; source: ItemSourceModule }
  'item:updated': { id: string }
  'item:removed': { ids: string[] }
  /** M2 文章阅读点击查词 → M1 生词本 */
  'article:word-lookup': { ru: string; zh?: string; refId?: string }
  'review:graded': { id: string; rating: Rating }
  'review:finished': { count: number }
  'module:error': { moduleId: string; message: string }
  'toast': { message: string; tone?: 'info' | 'success' | 'warn' | 'error' }
}

type Handler<K extends keyof PlatformEvents> = (payload: PlatformEvents[K]) => void

class EventBus {
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
export type { EventBus }
