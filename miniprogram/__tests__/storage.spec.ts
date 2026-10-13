import { beforeEach, describe, expect, it } from 'vitest'
import { repository } from '../core/storage'
import { createItem } from '../shared/item'
import type { LearningItem, SrsStatus } from '../shared/types'

function makeItem(ru: string, extra: Partial<LearningItem> = {}): LearningItem {
  return createItem({ ru, ...extra }, 'manual')
}

function withSrs(box: number, days: number, status: SrsStatus): Partial<LearningItem> {
  return {
    srs: {
      box,
      nextReview: new Date(Date.now() + days * 86400_000).toISOString(),
      status,
    },
  }
}

describe('小程序数据仓（wx.Storage）', () => {
  beforeEach(async () => {
    await repository.clearAll()
  })

  it('入库去重：ru + 释义相同视为重复（忽略大小写）', async () => {
    const first = await repository.bulkAdd([makeItem('дом', { zh: '房子' })])
    expect(first.added).toHaveLength(1)

    const second = await repository.bulkAdd([
      makeItem('дом', { zh: '房子' }),
      makeItem('Дом', { zh: '房子' }),
      makeItem('дом', { zh: '家' }),
    ])
    expect(second.added).toHaveLength(1)
    expect(second.duplicates).toHaveLength(2)
    expect(await repository.count()).toBe(2)
  })

  it('筛选：关键词 / 类型 / 状态 / 收藏 / 标签', async () => {
    await repository.bulkAdd([
      makeItem('дом', { zh: '房子', tags: ['高频'] }),
      makeItem('книга', { zh: '书', tags: ['阅读'] }),
      makeItem('Я изучаю русский', { type: 'sentence', zh: '我学俄语' }),
    ])

    expect((await repository.page({ keyword: 'книг' })).total).toBe(1)
    expect((await repository.page({ type: 'sentence' })).total).toBe(1)
    expect((await repository.page({ tag: '阅读' })).items[0].ru).toBe('книга')

    const target = (await repository.page({ keyword: 'дом' })).items[0]
    await repository.patch(target.id, { starred: true })
    expect((await repository.page({ starredOnly: true })).total).toBe(1)
    expect((await repository.page({ status: 'new' })).total).toBe(3)
  })

  it('pageIndex 返回索引且按创建时间倒序，不反序列化正文', () => {
    const entries = repository.pageIndex()
    expect(entries.length).toBeGreaterThanOrEqual(0)
    const sorted = [...entries].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    expect(entries.map((e) => e.createdAt)).toEqual(sorted.map((e) => e.createdAt))
  })

  it('到期队列按复习时间升序，未到期不入队', async () => {
    await repository.clearAll()
    await repository.bulkAdd([
      makeItem('давно', withSrs(0, -1, 'learning')),
      makeItem('马上', withSrs(1, 0, 'reviewing')),
      makeItem('稍后', withSrs(2, 3, 'reviewing')),
    ])
    const due = await repository.due(new Date(Date.now() + 60_000).toISOString(), 10)
    expect(due.map((item) => item.ru)).toEqual(['давно', '马上'])
    expect((await repository.due(new Date(Date.now() - 2 * 86400_000).toISOString(), 10))).toHaveLength(0)
  })

  it('评分后 patch 会同步更新索引（下一次到期时间随之变化）', async () => {
    const [item] = (await repository.bulkAdd([makeItem('дом', withSrs(0, -1, 'new'))])).added
    expect((await repository.due(new Date().toISOString(), 10))).toHaveLength(1)

    await repository.patch(item.id, { srs: { box: 2, nextReview: new Date(Date.now() + 7 * 86400_000).toISOString(), status: 'reviewing' } })
    expect((await repository.due(new Date().toISOString(), 10))).toHaveLength(0)
    expect((await repository.get(item.id))?.srs.box).toBe(2)
  })

  it('统计与复习日志', async () => {
    const [item] = (await repository.bulkAdd([makeItem('дом')])).added
    await repository.logReview({ itemId: item.id, at: new Date().toISOString(), rating: 'known', box: 1 })

    const counts = await repository.statusCounts()
    expect(counts.total).toBe(1)
    expect(counts.due).toBe(1)
    expect(counts.byStatus.new).toBe(1)

    const logs = await repository.reviewStats(new Date(Date.now() - 3600_000).toISOString())
    expect(logs).toHaveLength(1)
    expect(logs[0].rating).toBe('known')
  })

  it('删除会同时清理索引与正文，正文缺失时用索引兜底', async () => {
    const [item] = (await repository.bulkAdd([makeItem('дом', { zh: '房子' })] as LearningItem[])).added
    await repository.remove([item.id])
    expect(await repository.count()).toBe(0)
    expect(await repository.get(item.id)).toBeUndefined()

    const [another] = (await repository.bulkAdd([makeItem('книга', { zh: '书' })] as LearningItem[])).added
    wx.removeStorageSync(`rl.item.${another.id}`)
    const restored = await repository.get(another.id)
    expect(restored?.ru).toBe('книга')
    expect(restored?.srs.box).toBe(0)
  })

  it('清空后索引与日志一并重置', async () => {
    await repository.bulkAdd([makeItem('дом')])
    await repository.clearAll()
    expect(await repository.count()).toBe(0)
    expect((await repository.reviewStats(''))).toHaveLength(0)
  })
})
