import { describe, expect, it } from 'vitest'
import { createItem } from '@/core/db/repository'
import { buildBackup, parseBackup, parseCsv, toCsv } from '@/core/db/backup'
import type { LearningItem } from '@/core/types'

const items: LearningItem[] = [
  createItem({ ru: 'дом', zh: '房子', pos: 'noun', tags: ['高频', '名词'] }),
  createItem({ ru: 'книга, журнал', zh: '书，杂志', tags: ['阅读'] }),
]

describe('备份与导入导出', () => {
  it('CSV 导出后可解析回等价内容（含逗号转义）', () => {
    const csv = toCsv(items)
    const parsed = parseCsv(csv)
    expect(parsed).toHaveLength(2)
    expect(parsed[0].ru).toBe('дом')
    expect(parsed[0].zh).toBe('房子')
    expect(parsed[0].tags).toEqual(['高频', '名词'])
    expect(parsed[1].ru).toBe('книга, журнал')
  })

  it('JSON 备份支持 { items } 结构与裸数组两种格式', () => {
    const wrapped = JSON.stringify(buildBackup(items, []))
    expect(parseBackup(wrapped).items).toHaveLength(2)

    const bare = JSON.stringify(items)
    expect(parseBackup(bare).items).toHaveLength(2)
  })

  it('导入的条目补全默认字段（SRS / 来源 / 标签）', () => {
    const [item] = parseBackup(JSON.stringify([{ ru: 'язык', zh: '语言' }])).items
    expect(item.type).toBe('word')
    expect(item.srs.box).toBe(0)
    expect(item.source.module).toBe('manual')
    expect(item.tags).toEqual([])
    expect(item.starred).toBe(false)
  })

  it('缺少 ru 的脏数据被过滤', () => {
    const parsed = parseBackup(JSON.stringify([{ ru: 'дом' }, { zh: '没有原文' }, null]))
    expect(parsed.items).toHaveLength(1)
  })
})
