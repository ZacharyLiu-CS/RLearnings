/**
 * 小程序端数据仓：基于 wx.Storage 实现与 Web 端相同的 ItemRepository 契约。
 *
 * 设计要点：
 * - 索引（rl.idx）只存列表与筛选所需字段，列表/统计/到期队列全部走索引，避免每次全量反序列化；
 * - 正文按条存储（rl.item.<id>），渲染时只反序列化视口内条目（配合窗口化列表）；
 * - 写操作先更新内存索引再落盘，批量入库只在最后写一次索引。
 */
import { dedupeKey, matches, sortByCreatedDesc, toIndex } from '../shared/item'
import type {
  BulkResult,
  ItemIndex,
  ItemPage,
  ItemQuery,
  ItemRepository,
  LearningItem,
  ReviewLog,
  SrsStatus,
  StatusCounts,
} from '../shared/types'
import { createId } from '../shared/utils/id'
import { isoNow } from '../shared/utils/date'

const IDX_KEY = 'rl.idx'
const LOGS_KEY = 'rl.logs'
const itemKey = (id: string): string => `rl.item.${id}`

const MAX_LOGS = 3000

class StorageRepository implements ItemRepository {
  readonly backend = 'miniprogram-storage'

  private index: ItemIndex[] | null = null
  private logs: ReviewLog[] | null = null

  private readIndex(): ItemIndex[] {
    if (!this.index) {
      const stored = wx.getStorageSync<ItemIndex[]>(IDX_KEY)
      this.index = Array.isArray(stored) ? stored : []
    }
    return this.index
  }

  private writeIndex(): void {
    wx.setStorageSync(IDX_KEY, this.index ?? [])
  }

  private readLogs(): ReviewLog[] {
    if (!this.logs) {
      const stored = wx.getStorageSync<ReviewLog[]>(LOGS_KEY)
      this.logs = Array.isArray(stored) ? stored : []
    }
    return this.logs
  }

  private writeLogs(): void {
    const logs = this.logs ?? []
    wx.setStorageSync(LOGS_KEY, logs.length > MAX_LOGS ? logs.slice(-MAX_LOGS) : logs)
  }

  /** 正文缺失（存储被系统清理）时用索引重建最小可用条目，保证复习流程不中断 */
  private hydrate(entry: ItemIndex): LearningItem {
    const stored = wx.getStorageSync<LearningItem>(itemKey(entry.id))
    if (stored && stored.id) return stored
    return {
      ...entry,
      stress: undefined,
      forms: undefined,
      example: undefined,
      note: undefined,
    } as LearningItem
  }

  private upsertIndex(item: LearningItem): void {
    const index = this.readIndex()
    const position = index.findIndex((entry) => entry.id === item.id)
    const entry = toIndex(item)
    if (position >= 0) index[position] = entry
    else index.push(entry)
  }

  async count(): Promise<number> {
    return this.readIndex().length
  }

  async page(query: ItemQuery = {}): Promise<ItemPage> {
    const rows = this.readIndex().filter((entry) => matches(entry, query))
    sortByCreatedDesc(rows)
    const offset = query.offset ?? 0
    const limit = query.limit ?? 200
    return {
      items: rows.slice(offset, offset + limit).map((entry) => this.hydrate(entry)),
      total: rows.length,
    }
  }

  /**
   * 只返回索引（不反序列化正文），供长列表与统计使用。
   * 属于小程序端额外能力：契约之外的补充方法。
   */
  pageIndex(query: ItemQuery = {}): ItemIndex[] {
    const rows = this.readIndex().filter((entry) => matches(entry, query))
    sortByCreatedDesc(rows)
    const offset = query.offset ?? 0
    const limit = query.limit ?? 20000
    return rows.slice(offset, offset + limit)
  }

  async get(id: string): Promise<LearningItem | undefined> {
    const entry = this.readIndex().find((row) => row.id === id)
    return entry ? this.hydrate(entry) : undefined
  }

  async findByRu(ru: string): Promise<LearningItem[]> {
    const key = ru.trim().toLowerCase()
    return this.readIndex()
      .filter((entry) => entry.ru.trim().toLowerCase() === key)
      .map((entry) => this.hydrate(entry))
  }

  async bulkAdd(items: LearningItem[]): Promise<BulkResult> {
    const index = this.readIndex()
    const seen = new Set(index.map((entry) => dedupeKey({ ru: entry.ru, zh: entry.zh })))
    const added: LearningItem[] = []
    const duplicates: string[] = []

    for (const item of items) {
      const key = dedupeKey(item)
      if (seen.has(key)) {
        duplicates.push(item.ru)
        continue
      }
      seen.add(key)
      wx.setStorageSync(itemKey(item.id), item)
      this.upsertIndex(item)
      added.push(item)
    }
    this.writeIndex()
    return { added, duplicates }
  }

  async put(item: LearningItem): Promise<void> {
    wx.setStorageSync(itemKey(item.id), item)
    this.upsertIndex(item)
    this.writeIndex()
  }

  async patch(id: string, patch: Partial<LearningItem>): Promise<void> {
    const current = await this.get(id)
    if (!current) return
    const next: LearningItem = { ...current, ...patch, id }
    wx.setStorageSync(itemKey(id), next)
    this.upsertIndex(next)
    this.writeIndex()
  }

  async remove(ids: string[]): Promise<void> {
    const index = this.readIndex()
    this.index = index.filter((entry) => !ids.includes(entry.id))
    for (const id of ids) wx.removeStorageSync(itemKey(id))
    this.writeIndex()
  }

  async due(nowIso: string, limit: number): Promise<LearningItem[]> {
    const rows = this.readIndex()
      .filter((entry) => entry.srs.nextReview <= nowIso)
      .sort((a, b) => (a.srs.nextReview < b.srs.nextReview ? -1 : 1))
      .slice(0, limit)
    return rows.map((entry) => this.hydrate(entry))
  }

  async all(): Promise<LearningItem[]> {
    return this.readIndex().map((entry) => this.hydrate(entry))
  }

  async clearAll(): Promise<void> {
    for (const entry of this.readIndex()) wx.removeStorageSync(itemKey(entry.id))
    this.index = []
    this.logs = []
    wx.removeStorageSync(IDX_KEY)
    wx.removeStorageSync(LOGS_KEY)
  }

  async logReview(log: Omit<ReviewLog, 'id'>): Promise<void> {
    this.readLogs().push({ ...log, id: createId('rv') })
    this.writeLogs()
  }

  async reviewStats(sinceIso: string): Promise<ReviewLog[]> {
    return this.readLogs().filter((log) => log.at > sinceIso)
  }

  async statusCounts(): Promise<StatusCounts> {
    const index = this.readIndex()
    const now = isoNow()
    const byStatus: Record<SrsStatus, number> = {
      new: 0,
      learning: 0,
      reviewing: 0,
      mastered: 0,
    }
    for (const entry of index) byStatus[entry.srs.status] += 1
    return {
      total: index.length,
      due: index.filter((entry) => entry.srs.nextReview <= now).length,
      byStatus,
    }
  }

  /** 估算占用（KB），用于统计页的存储健康提示 */
  estimateSizeKb(): number {
    const res = wx.getStorageInfoSync()
    return Math.round(res.currentSize)
  }
}

export const repository = new StorageRepository()
