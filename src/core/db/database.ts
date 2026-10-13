/**
 * 本地数据仓：IndexedDB（Dexie 封装）。
 * 版本化迁移：schema 变更必须新增 version 并写 upgrade，禁止裸改已有索引。
 */
import Dexie, { type Table } from 'dexie'
import type { LearningItem, ReviewLog } from '@/core/types'

export interface MetaRecord {
  key: string
  value: unknown
}

export class LearningDatabase extends Dexie {
  items!: Table<LearningItem, string>
  reviewLogs!: Table<ReviewLog, string>
  meta!: Table<MetaRecord, string>

  constructor(name = 'russian-learning') {
    super(name)
    this.version(1).stores({
      // 索引覆盖查询字段：类型 / 状态 / 下次复习时间 / 来源 / 标签
      items:
        'id, type, ru, starred, createdAt, srs.box, srs.status, srs.nextReview, source.module, *tags',
      reviewLogs: 'id, itemId, at',
      meta: 'key',
    })
  }
}

export const db = new LearningDatabase()

export type DbStatus = 'pending' | 'ok' | 'unavailable'

/**
 * 打开数据库；Safari 隐私模式等场景下 IndexedDB 不可用，
 * 由上层降级为内存态并提示导出。
 */
export async function openDatabase(): Promise<{ status: DbStatus; message?: string }> {
  try {
    if (!db.isOpen()) await db.open()
    return { status: 'ok' }
  } catch (err) {
    return {
      status: 'unavailable',
      message: err instanceof Error ? err.message : String(err),
    }
  }
}
