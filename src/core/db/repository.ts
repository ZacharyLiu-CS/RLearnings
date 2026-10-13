/**
 * 统一数据仓读写层：所有模块共享同一份 LearningItem 存储，
 * 这是「阅读查词 / 对话生词 / 跟读难点 → 词库复习」闭环的基础。
 */
import { db } from '@/core/db/database'
import { srs } from '@/core/srs'
import type {
  ItemSourceModule,
  LearningItem,
  LearningItemType,
  ReviewLog,
  SrsStatus,
} from '@/core/types'
import { createId } from '@/core/utils/id'
import { isoNow } from '@/core/utils/date'

export interface ItemQuery {
  keyword?: string
  type?: LearningItemType | 'all'
  status?: SrsStatus | 'all'
  starredOnly?: boolean
  tag?: string
  source?: ItemSourceModule | 'all'
  limit?: number
  offset?: number
}

export interface ItemPage {
  items: LearningItem[]
  total: number
}

export interface BulkResult {
  added: LearningItem[]
  duplicates: string[]
}

export interface StatusCounts {
  total: number
  due: number
  byStatus: Record<SrsStatus, number>
}

export interface ItemRepository {
  readonly backend: 'indexeddb' | 'memory'
  count(): Promise<number>
  page(query?: ItemQuery): Promise<ItemPage>
  get(id: string): Promise<LearningItem | undefined>
  findByRu(ru: string): Promise<LearningItem[]>
  bulkAdd(items: LearningItem[]): Promise<BulkResult>
  put(item: LearningItem): Promise<void>
  patch(id: string, patch: Partial<LearningItem>): Promise<void>
  remove(ids: string[]): Promise<void>
  due(nowIso: string, limit: number): Promise<LearningItem[]>
  all(): Promise<LearningItem[]>
  clearAll(): Promise<void>
  logReview(log: Omit<ReviewLog, 'id'>): Promise<void>
  reviewStats(sinceIso: string): Promise<ReviewLog[]>
  statusCounts(): Promise<StatusCounts>
}

const DEFAULT_LIMIT = 2000

function normalize(value: string | undefined): string {
  return (value ?? '').trim().toLowerCase()
}

function dedupeKey(item: Pick<LearningItem, 'ru' | 'zh'>): string {
  return `${normalize(item.ru)}|${normalize(item.zh)}`
}

function matches(item: LearningItem, query: ItemQuery): boolean {
  if (query.status && query.status !== 'all' && item.srs.status !== query.status) return false
  if (query.type && query.type !== 'all' && item.type !== query.type) return false
  if (query.starredOnly && !item.starred) return false
  if (query.tag && !item.tags.includes(query.tag)) return false
  if (query.source && query.source !== 'all' && item.source.module !== query.source) return false
  const keyword = normalize(query.keyword)
  if (keyword) {
    const haystack = normalize(
      [item.ru, item.zh, item.pos, item.forms, item.note, item.tags.join(' '), item.example].join(' '),
    )
    if (!haystack.includes(keyword)) return false
  }
  return true
}

function sortByCreatedDesc(items: LearningItem[]): LearningItem[] {
  return items.sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0))
}

class DexieRepository implements ItemRepository {
  readonly backend = 'indexeddb' as const

  count(): Promise<number> {
    return db.items.count()
  }

  async page(query: ItemQuery = {}): Promise<ItemPage> {
    // 优先走索引缩小范围，再在 JS 内做文本/标签过滤（万级数据下 < 100ms）
    const indexQuery =
      query.status && query.status !== 'all'
        ? db.items.where('srs.status').equals(query.status)
        : query.type && query.type !== 'all'
          ? db.items.where('type').equals(query.type)
          : db.items.toCollection()

    const rows = await indexQuery.filter((item) => matches(item, query)).toArray()
    sortByCreatedDesc(rows)
    const offset = query.offset ?? 0
    const limit = query.limit ?? DEFAULT_LIMIT
    return { items: rows.slice(offset, offset + limit), total: rows.length }
  }

  get(id: string): Promise<LearningItem | undefined> {
    return db.items.get(id)
  }

  findByRu(ru: string): Promise<LearningItem[]> {
    return db.items.where('ru').equals(ru.trim()).toArray()
  }

  async bulkAdd(items: LearningItem[]): Promise<BulkResult> {
    if (!items.length) return { added: [], duplicates: [] }
    const rus = [...new Set(items.map((item) => item.ru.trim()))].filter(Boolean)
    const existing = rus.length ? await db.items.where('ru').anyOf(rus).toArray() : []
    const seen = new Set(existing.map(dedupeKey))
    const added: LearningItem[] = []
    const duplicates: string[] = []
    const seenInBatch = new Set<string>()

    for (const item of items) {
      const key = dedupeKey(item)
      if (seen.has(key) || seenInBatch.has(key)) {
        duplicates.push(item.ru)
        continue
      }
      seenInBatch.add(key)
      added.push(item)
    }
    if (added.length) await db.items.bulkAdd(added)
    return { added, duplicates }
  }

  put(item: LearningItem): Promise<void> {
    return db.items.put(item).then(() => undefined)
  }

  async patch(id: string, patch: Partial<LearningItem>): Promise<void> {
    const current = await db.items.get(id)
    if (!current) return
    await db.items.put({ ...current, ...patch, id: current.id })
  }

  remove(ids: string[]): Promise<void> {
    return db.items.bulkDelete(ids)
  }

  async due(nowIso: string, limit: number): Promise<LearningItem[]> {
    const rows = await db.items.where('srs.nextReview').belowOrEqual(nowIso).toArray()
    return rows.sort((a, b) => (a.srs.nextReview < b.srs.nextReview ? -1 : 1)).slice(0, limit)
  }

  all(): Promise<LearningItem[]> {
    return db.items.toArray()
  }

  async clearAll(): Promise<void> {
    await db.transaction('rw', db.items, db.reviewLogs, async () => {
      await db.items.clear()
      await db.reviewLogs.clear()
    })
  }

  async logReview(log: Omit<ReviewLog, 'id'>): Promise<void> {
    await db.reviewLogs.add({ ...log, id: createId('rv') })
  }

  reviewStats(sinceIso: string): Promise<ReviewLog[]> {
    return db.reviewLogs.where('at').above(sinceIso).toArray()
  }

  async statusCounts(): Promise<StatusCounts> {
    const [total, due, ...counts] = await Promise.all([
      db.items.count(),
      db.items.where('srs.nextReview').belowOrEqual(isoNow()).count(),
      db.items.where('srs.status').equals('new').count(),
      db.items.where('srs.status').equals('learning').count(),
      db.items.where('srs.status').equals('reviewing').count(),
      db.items.where('srs.status').equals('mastered').count(),
    ])
    return {
      total,
      due,
      byStatus: { new: counts[0], learning: counts[1], reviewing: counts[2], mastered: counts[3] },
    }
  }
}

class MemoryRepository implements ItemRepository {
  readonly backend = 'memory' as const
  private items = new Map<string, LearningItem>()
  private logs: ReviewLog[] = []

  count(): Promise<number> {
    return Promise.resolve(this.items.size)
  }

  async page(query: ItemQuery = {}): Promise<ItemPage> {
    const rows = [...this.items.values()].filter((item) => matches(item, query))
    sortByCreatedDesc(rows)
    const offset = query.offset ?? 0
    const limit = query.limit ?? DEFAULT_LIMIT
    return { items: rows.slice(offset, offset + limit), total: rows.length }
  }

  get(id: string): Promise<LearningItem | undefined> {
    return Promise.resolve(this.items.get(id))
  }

  findByRu(ru: string): Promise<LearningItem[]> {
    const key = normalize(ru)
    return Promise.resolve([...this.items.values()].filter((i) => normalize(i.ru) === key))
  }

  async bulkAdd(items: LearningItem[]): Promise<BulkResult> {
    const added: LearningItem[] = []
    const duplicates: string[] = []
    const seen = new Set([...this.items.values()].map(dedupeKey))
    for (const item of items) {
      const key = dedupeKey(item)
      if (seen.has(key)) {
        duplicates.push(item.ru)
        continue
      }
      seen.add(key)
      this.items.set(item.id, item)
      added.push(item)
    }
    return { added, duplicates }
  }

  async put(item: LearningItem): Promise<void> {
    this.items.set(item.id, item)
  }

  async patch(id: string, patch: Partial<LearningItem>): Promise<void> {
    const current = this.items.get(id)
    if (current) this.items.set(id, { ...current, ...patch, id })
  }

  async remove(ids: string[]): Promise<void> {
    for (const id of ids) this.items.delete(id)
  }

  async due(nowIso: string, limit: number): Promise<LearningItem[]> {
    return [...this.items.values()]
      .filter((item) => item.srs.nextReview <= nowIso)
      .sort((a, b) => (a.srs.nextReview < b.srs.nextReview ? -1 : 1))
      .slice(0, limit)
  }

  all(): Promise<LearningItem[]> {
    return Promise.resolve([...this.items.values()])
  }

  async clearAll(): Promise<void> {
    this.items.clear()
    this.logs = []
  }

  async logReview(log: Omit<ReviewLog, 'id'>): Promise<void> {
    this.logs.push({ ...log, id: createId('rv') })
  }

  reviewStats(sinceIso: string): Promise<ReviewLog[]> {
    return Promise.resolve(this.logs.filter((log) => log.at > sinceIso))
  }

  async statusCounts(): Promise<StatusCounts> {
    const rows = [...this.items.values()]
    const now = isoNow()
    const byStatus: Record<SrsStatus, number> = {
      new: 0,
      learning: 0,
      reviewing: 0,
      mastered: 0,
    }
    for (const item of rows) byStatus[item.srs.status] += 1
    return {
      total: rows.length,
      due: rows.filter((item) => item.srs.nextReview <= now).length,
      byStatus,
    }
  }
}

const dexieRepo = new DexieRepository()
const memoryRepo = new MemoryRepository()
let active: ItemRepository = dexieRepo

/** IndexedDB 不可用时降级为内存态（刷新即失，提醒用户导出） */
export function switchToMemoryBackend(): void {
  active = memoryRepo
}

export function currentBackend(): 'indexeddb' | 'memory' {
  return active.backend
}

/** 对外的仓储代理：运行期可切换后端，调用方无感知 */
export const repository: ItemRepository = {
  get backend() {
    return active.backend
  },
  count: (...args) => active.count(...args),
  page: (...args) => active.page(...args),
  get: (...args) => active.get(...args),
  findByRu: (...args) => active.findByRu(...args),
  bulkAdd: (...args) => active.bulkAdd(...args),
  put: (...args) => active.put(...args),
  patch: (...args) => active.patch(...args),
  remove: (...args) => active.remove(...args),
  due: (...args) => active.due(...args),
  all: (...args) => active.all(...args),
  clearAll: (...args) => active.clearAll(...args),
  logReview: (...args) => active.logReview(...args),
  reviewStats: (...args) => active.reviewStats(...args),
  statusCounts: (...args) => active.statusCounts(...args),
}

/** 新建学习条目的工厂：统一默认值，保证各模块产出的数据结构一致 */
export function createItem(input: Partial<LearningItem> & { ru: string }): LearningItem {
  const now = isoNow()
  return {
    id: input.id ?? createId('it'),
    type: input.type ?? 'word',
    ru: input.ru.trim(),
    stress: input.stress,
    pos: input.pos,
    zh: input.zh?.trim(),
    forms: input.forms,
    example: input.example,
    note: input.note,
    tags: input.tags ?? [],
    source: input.source ?? { module: 'manual' },
    srs: input.srs ?? srs.create('new', new Date(now)),
    starred: input.starred ?? false,
    createdAt: input.createdAt ?? now,
  }
}
