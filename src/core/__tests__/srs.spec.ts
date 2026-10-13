import { describe, expect, it } from 'vitest'
import { srs, INTERVALS, DAY_MS } from '@/core/srs'
import type { SrsState } from '@/core/types'

const NOW = new Date('2026-01-05T10:00:00.000Z')
const BASE: SrsState = {
  box: 0,
  nextReview: new Date('2026-01-01T10:00:00.000Z').toISOString(),
  status: 'new',
}

function daysFromNow(state: SrsState): number {
  return Math.round((new Date(state.nextReview).getTime() - NOW.getTime()) / DAY_MS)
}

describe('SRS 调度器', () => {
  it('认识：box +1，间隔取下一档', () => {
    const next = srs.schedule(BASE, 'known', NOW)
    expect(next.box).toBe(1)
    expect(daysFromNow(next)).toBe(INTERVALS[1])
    expect(next.status).toBe('reviewing')
  })

  it('模糊：box 不变，间隔缩短为 1 天', () => {
    const current: SrsState = { ...BASE, box: 2, status: 'reviewing' }
    const next = srs.schedule(current, 'fuzzy', NOW)
    expect(next.box).toBe(2)
    expect(daysFromNow(next)).toBe(1)
  })

  it('不认识：box 归零，当日重现', () => {
    const current: SrsState = { ...BASE, box: 3, status: 'reviewing' }
    const next = srs.schedule(current, 'unknown', NOW)
    expect(next.box).toBe(0)
    expect(next.status).toBe('learning')
    expect(new Date(next.nextReview).getTime()).toBeLessThanOrEqual(NOW.getTime() + 60_000)
  })

  it('box 上限为最高档，不越界', () => {
    const current: SrsState = { ...BASE, box: INTERVALS.length - 1, status: 'mastered' }
    const next = srs.schedule(current, 'known', NOW)
    expect(next.box).toBe(INTERVALS.length - 1)
    expect(next.status).toBe('mastered')
    expect(daysFromNow(next)).toBe(INTERVALS[INTERVALS.length - 1])
  })

  it('到期判断与剩余天数', () => {
    const past: SrsState = { ...BASE, nextReview: new Date(NOW.getTime() - DAY_MS).toISOString() }
    const future: SrsState = { ...BASE, nextReview: new Date(NOW.getTime() + 3 * DAY_MS).toISOString() }
    expect(srs.isDue(past, NOW)).toBe(true)
    expect(srs.isDue(future, NOW)).toBe(false)
    expect(srs.daysUntil(future, NOW)).toBe(3)
  })

  it('新条目默认立即可复习', () => {
    const fresh = srs.create('new', NOW)
    expect(fresh.box).toBe(0)
    expect(fresh.status).toBe('new')
    expect(srs.isDue(fresh, NOW)).toBe(true)
  })
})
