import { describe, expect, it, vi } from 'vitest'
import { bus } from '@/core/event-bus'

describe('事件总线', () => {
  it('订阅后可收到事件，取消订阅后不再收到', () => {
    const handler = vi.fn()
    const off = bus.on('item:added', handler)
    bus.emit('item:added', { items: [], source: 'manual' })
    off()
    bus.emit('item:added', { items: [], source: 'manual' })
    expect(handler).toHaveBeenCalledTimes(1)
  })

  it('once 只触发一次', () => {
    const handler = vi.fn()
    bus.once('review:finished', handler)
    bus.emit('review:finished', { count: 1 })
    bus.emit('review:finished', { count: 2 })
    expect(handler).toHaveBeenCalledTimes(1)
    expect(handler).toHaveBeenCalledWith({ count: 1 })
  })

  it('单个订阅者抛错不影响其他订阅者，也不影响发布方', () => {
    const broken = vi.fn(() => {
      throw new Error('boom')
    })
    const healthy = vi.fn()
    bus.on('item:added', broken)
    bus.on('item:added', healthy)
    expect(() => bus.emit('item:added', { items: [], source: 'reading' })).not.toThrow()
    expect(healthy).toHaveBeenCalledTimes(1)
    bus.off('item:added', broken)
    bus.off('item:added', healthy)
  })
})
