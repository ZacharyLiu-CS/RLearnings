/**
 * SRS 调度器：平台核心能力，M1 词条 / M2 句子 / M4 跟读共用同一调度。
 */
import type { Rating, SrsState } from '@/core/types'

/** 间隔天数数组，索引即 box */
export const INTERVALS = [1, 3, 7, 14, 30] as const

export const DAY_MS = 24 * 60 * 60 * 1000

export interface SrsScheduler {
  readonly intervals: readonly number[]
  create(status?: SrsState['status'], now?: Date): SrsState
  /** 根据评分返回新的 SRS 状态（纯函数，便于测试与乐观更新） */
  schedule(srs: SrsState, rating: Rating, now?: Date): SrsState
  isDue(srs: SrsState, now?: Date): boolean
  /** 距下次复习的天数（用于列表展示），负数表示已逾期 */
  daysUntil(srs: SrsState, now?: Date): number
}

function toIso(date: Date): string {
  return date.toISOString()
}

function addDays(base: Date, days: number): Date {
  return new Date(base.getTime() + days * DAY_MS)
}

function statusForBox(box: number): SrsState['status'] {
  if (box <= 0) return 'learning'
  if (box >= INTERVALS.length - 1) return 'mastered'
  return 'reviewing'
}

export const srs: SrsScheduler = {
  intervals: INTERVALS,

  create(status = 'new', now = new Date()) {
    return {
      box: 0,
      nextReview: toIso(now),
      status,
    }
  },

  schedule(current, rating, now = new Date()) {
    let box = current.box
    let next: Date

    if (rating === 'known') {
      box = Math.min(current.box + 1, INTERVALS.length - 1)
      next = addDays(now, INTERVALS[box])
    } else if (rating === 'fuzzy') {
      // 模糊：box 不变，间隔缩短为 1 天
      box = Math.min(current.box, INTERVALS.length - 1)
      next = addDays(now, 1)
    } else {
      // 不认识：归零，当日重现
      box = 0
      next = new Date(now.getTime() + 60 * 1000)
    }

    return {
      box,
      nextReview: toIso(next),
      status: rating === 'unknown' ? 'learning' : statusForBox(box),
    }
  },

  isDue(current, now = new Date()) {
    return new Date(current.nextReview).getTime() <= now.getTime()
  },

  daysUntil(current, now = new Date()) {
    const diff = new Date(current.nextReview).getTime() - now.getTime()
    return Math.round(diff / DAY_MS)
  },
}
