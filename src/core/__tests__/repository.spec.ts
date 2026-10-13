import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { createItem, repository, switchToMemoryBackend } from '@/core/db/repository'
import type { LearningItem } from '@/core/types'

async function seed(): Promise<void> {
  await repository.bulkAdd([
    createItem({ ru: 'дом', zh: '房子', pos: 'noun', tags: ['高频'] }),
    createItem({ ru: 'книга', zh: '书', pos: 'noun', tags: ['阅读'] }),
    createItem({ ru: 'говорить', zh: '说', pos: 'verb', type: 'sentence' }),
  ])
}

describe('统一数据仓（IndexedDB）', () => {
  beforeEach(async () => {
    await repository.clearAll()
  })

  it('批量入库并按 ru + 释义去重', async () => {
    const first = await repository.bulkAdd([createItem({ ru: 'дом', zh: '房子' })])
    expect(first.added).toHaveLength(1)

    const second = await repository.bulkAdd([
      createItem({ ru: 'дом', zh: '房子' }),
      createItem({ ru: 'Дом', zh: '房子' }), // 大小写差异同样视为重复
      createItem({ ru: 'дом', zh: '家' }),
    ])
    expect(second.added).toHaveLength(1)
    expect(second.duplicates).toHaveLength(2)
    expect(await repository.count()).toBe(2)
  })

  it('支持关键词 / 类型 / 状态 / 收藏 / 标签筛选', async () => {
    await seed()
    const all = await repository.page()
    expect(all.total).toBe(3)

    const byKeyword = await repository.page({ keyword: 'книг' })
    expect(byKeyword.items.map((i) => i.ru)).toEqual(['книга'])

    const byType = await repository.page({ type: 'sentence' })
    expect(byType.total).toBe(1)

    const byTag = await repository.page({ tag: '阅读' })
    expect(byTag.items[0].ru).toBe('книга')

    const target = all.items.find((i) => i.ru === 'дом') as LearningItem
    await repository.patch(target.id, { starred: true })
    expect((await repository.page({ starredOnly: true })).total).toBe(1)
  })

  it('只取出到期条目，且按复习时间升序', async () => {
    await repository.clearAll()
    const now = new Date()
    await repository.bulkAdd([
      createItem({
        ru: 'давно',
        srs: { box: 0, nextReview: new Date(now.getTime() - 86400_000).toISOString(), status: 'learning' },
      }),
      createItem({
        ru: '马上',
        srs: { box: 1, nextReview: new Date(now.getTime() + 60_000).toISOString(), status: 'reviewing' },
      }),
      createItem({
        ru: '稍后',
        srs: { box: 2, nextReview: new Date(now.getTime() + 3 * 86400_000).toISOString(), status: 'reviewing' },
      }),
      createItem({
        ru: '现在',
        srs: { box: 0, nextReview: now.toISOString(), status: 'new' },
      }),
    ])

    const due = await repository.due(new Date(now.getTime() + 120_000).toISOString(), 10)
    expect(due.map((i) => i.ru)).toEqual(['давно', '现在', '马上'])
    expect((await repository.due(now.toISOString(), 1))).toHaveLength(1)
  })

  it('统计接口返回总数、待复习与各状态数量', async () => {
    await seed()
    const counts = await repository.statusCounts()
    expect(counts.total).toBe(3)
    expect(counts.due).toBe(3)
    expect(counts.byStatus.new).toBe(3)
    expect(counts.byStatus.mastered).toBe(0)
  })

  it('复习日志可按时间窗口查询', async () => {
    const [item] = (await repository.bulkAdd([createItem({ ru: 'дом' })])).added
    await repository.logReview({ itemId: item.id, at: new Date().toISOString(), rating: 'known', box: 1 })
    const logs = await repository.reviewStats(new Date(Date.now() - 3600_000).toISOString())
    expect(logs).toHaveLength(1)
    expect(logs[0].rating).toBe('known')
  })

  it('IndexedDB 不可用时可降级为内存态', async () => {
    switchToMemoryBackend()
    expect(repository.backend).toBe('memory')
    await repository.bulkAdd([createItem({ ru: 'язык', zh: '语言' })])
    const page = await repository.page({ keyword: 'язык' })
    expect(page.total).toBe(1)
    expect((await repository.statusCounts()).total).toBe(1)
  })
})
