/**
 * SRS 调度器（跨平台共享）：词条 / 句子 / 跟读共用同一调度。
 * 纯函数，便于单测与两端一致性。
 */
import type { Rating, SrsState } from './types'

export const INTERVALS = [1, 3, 7, 14, 30] as const

export const DAY_MS = 24 * 60 * 60 * 1000

function statusForBox(box: number): SrsState['status'] {
  if (box <= 0) return 'learning'
  if (box >= INTERVALS.length - 1) return 'mastered'
  return 'reviewing'
}

export function createSrs(status: SrsState['status'] = 'new', now: Date = new Date()): SrsState {
  return { box: 0, nextReview: now.toISOString(), status }
}

export function scheduleSrs(
  current: SrsState,
  rating: Rating,
  now: Date = new Date(),
): SrsState {
  let box = current.box
  let next: Date

  if (rating === 'known') {
    box = Math.min(current.box + 1, INTERVALS.length - 1)
    next = new Date(now.getTime() + INTERVALS[box] * DAY_MS)
  } else if (rating === 'fuzzy') {
    // 模糊：box 不变，间隔缩短为 1 天
    box = Math.min(current.box, INTERVALS.length - 1)
    next = new Date(now.getTime() + DAY_MS)
  } else {
    // 不认识：归零，当日重现
    box = 0
    next = new Date(now.getTime() + 60 * 1000)
  }

  return {
    box,
    nextReview: next.toISOString(),
    status: rating === 'unknown' ? 'learning' : statusForBox(box),
  }
}

export function isDue(current: SrsState, now: Date = new Date()): boolean {
  return new Date(current.nextReview).getTime() <= now.getTime()
}

export function daysUntil(current: SrsState, now: Date = new Date()): number {
  return Math.round((new Date(current.nextReview).getTime() - now.getTime()) / DAY_MS)
}

/** 面向调用方的门面（Web 与小程序均为同一实现） */
export const srs = {
  intervals: INTERVALS,
  create: createSrs,
  schedule: scheduleSrs,
  isDue,
  daysUntil,
}

export type SrsScheduler = typeof srs
