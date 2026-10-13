/**
 * 跨平台共享契约：与运行环境无关（无 DOM / 无 Vue / 无 wx 依赖）。
 * Web（IndexedDB）与小程序（Storage）都实现同一套 ItemRepository，
 * 保证「统一数据模型 + 统一 SRS 调度」在两个端行为一致。
 */

export type LearningItemType = 'word' | 'sentence' | 'collocation'

export type ItemSourceModule = 'manual' | 'ocr' | 'reading' | 'chat' | 'shadowing'

export type SrsStatus = 'new' | 'learning' | 'reviewing' | 'mastered'

export type Rating = 'known' | 'fuzzy' | 'unknown'

export interface SrsState {
  /** 0-4，对应间隔 1/3/7/14/30 天 */
  box: number
  nextReview: string
  status: SrsStatus
}

export interface ItemSource {
  module: ItemSourceModule
  refId?: string
}

export interface LearningItem {
  id: string
  type: LearningItemType
  ru: string
  stress?: string
  pos?: string
  zh?: string
  forms?: string
  example?: string
  note?: string
  tags: string[]
  source: ItemSource
  srs: SrsState
  starred: boolean
  createdAt: string
}

/** 列表索引条目：支撑筛选/排序/到期队列，避免每次全量读取正文 */
export interface ItemIndex {
  id: string
  type: LearningItemType
  ru: string
  zh?: string
  pos?: string
  tags: string[]
  source: ItemSource
  srs: SrsState
  starred: boolean
  createdAt: string
}

/** 筛选所需的最小字段集，LearningItem 与 ItemIndex 都满足 */
export type FilterableItem = Pick<
  LearningItem,
  'ru' | 'zh' | 'pos' | 'forms' | 'note' | 'tags' | 'type' | 'starred' | 'source' | 'srs'
>

export interface ReviewLog {
  id: string
  itemId: string
  at: string
  rating: Rating
  box: number
}

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
  readonly backend: string
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
