import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { reactive } from 'vue'
import { useWordsStore } from '@/modules/words/store'
import { createItem, repository } from '@/core/db/repository'

describe('单词模块 store', () => {
  beforeEach(async () => {
    setActivePinia(createPinia())
    await repository.clearAll()
  })

  it('录入去重，并记录来源模块', async () => {
    const store = useWordsStore()
    const first = await store.addItems([{ ru: 'дом', zh: '房子' }], 'manual')
    expect(first.added).toBe(1)

    const second = await store.addItems([{ ru: 'дом', zh: '房子' }], 'ocr')
    expect(second.added).toBe(0)
    expect(second.duplicates).toBe(1)

    expect(store.items).toHaveLength(1)
    expect(store.items[0].source.module).toBe('manual')
  })

  it('入库前去除响应式代理（IndexedDB 无法克隆 Proxy）', async () => {
    const store = useWordsStore()
    const draft = reactive({ ru: 'дом', zh: '房子', tags: ['高频'] })
    const { added } = await store.addItems([draft], 'manual')
    expect(added).toBe(1)
    const stored = (await repository.page({ keyword: 'дом' })).items[0]
    expect(stored.tags).toEqual(['高频'])
    expect(stored.zh).toBe('房子')
  })

  it('评分「认识」推进 box，「不认识」归零并在本组重现', async () => {
    const store = useWordsStore()
    await store.addItems([{ ru: 'дом' }, { ru: 'книга' }], 'manual')
    await store.loadDue(10)
    expect(store.queue).toHaveLength(2)

    const firstRu = store.queue[0].ru
    store.grade('known')
    expect(store.queue[0].srs.box).toBe(1)
    expect(store.queueIndex).toBe(1)

    const secondRu = store.current?.ru
    store.grade('unknown')
    expect(store.queue[1].srs.box).toBe(0)
    expect(store.queue).toHaveLength(3)
    expect(store.current?.ru).toBe(secondRu)
    expect(store.remaining).toBe(1)

    store.grade('known')
    expect(store.finished).toBe(true)
    expect(store.graded).toBe(3)
    expect([firstRu, secondRu].every(Boolean)).toBe(true)
  })

  it('未到期条目不进入复习队列', async () => {
    const store = useWordsStore()
    const future = new Date(Date.now() + 3 * 86400_000).toISOString()
    await repository.bulkAdd([
      createItem({ ru: 'будущее', srs: { box: 2, nextReview: future, status: 'reviewing' } }),
    ])
    await store.loadDue(10)
    expect(store.queue).toHaveLength(0)
    expect(store.current).toBeUndefined()
  })

  it('统计：连续打卡与 7 天曲线基于复习日志', async () => {
    const store = useWordsStore()
    const [item] = (await repository.bulkAdd([createItem({ ru: 'дом' })])).added
    await repository.logReview({ itemId: item.id, at: new Date().toISOString(), rating: 'known', box: 1 })
    await store.loadStats()

    expect(store.stats?.total).toBe(1)
    expect(store.streak).toBe(1)
    expect(store.curve).toHaveLength(7)
    expect(store.curve[6].count).toBe(1)
  })

  it('演示数据批量入库后可被检索', async () => {
    const store = useWordsStore()
    await store.seedDemo(500)
    expect(store.total).toBeGreaterThanOrEqual(500)
    const search = await repository.page({ keyword: 'дом' })
    expect(search.total).toBeGreaterThan(0)
  })
})
