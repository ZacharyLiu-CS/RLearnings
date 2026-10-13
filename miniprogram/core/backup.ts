/**
 * 小程序端备份：微信内无法直接下载文件，
 * 导出走「复制到剪贴板」，导入走「读取剪贴板」，与 Web 端 JSON/CSV 格式保持兼容。
 */
import { createItem, toCsv } from '../shared/item'
import type { LearningItem, ReviewLog } from '../shared/types'
import { repository } from './storage'
import { dayKey } from '../shared/utils/date'

export const BACKUP_VERSION = 1

export interface BackupFile {
  version: number
  exportedAt: string
  items: LearningItem[]
  reviewLogs: ReviewLog[]
}

export async function buildBackup(): Promise<BackupFile> {
  const [items, reviewLogs] = await Promise.all([repository.all(), repository.reviewStats('')])
  return { version: BACKUP_VERSION, exportedAt: new Date().toISOString(), items, reviewLogs }
}

export async function exportJsonToClipboard(): Promise<number> {
  const backup = await buildBackup()
  const text = JSON.stringify(backup)
  await wx.setClipboardData({ data: text })
  return backup.items.length
}

export async function exportCsvToClipboard(): Promise<number> {
  const items = await repository.all()
  await wx.setClipboardData({ data: toCsv(items) })
  return items.length
}

export function parseBackup(text: string): { items: LearningItem[]; reviewLogs: ReviewLog[] } {
  const data = JSON.parse(text) as Partial<BackupFile> & { items?: LearningItem[] }
  const rawItems = Array.isArray(data) ? data : (data.items ?? [])
  const items = rawItems
    .filter((item): item is LearningItem => Boolean(item && typeof item.ru === 'string'))
    .map((item) => createItem(item))
  return { items, reviewLogs: Array.isArray(data.reviewLogs) ? data.reviewLogs : [] }
}

export async function importFromClipboard(): Promise<{ added: number; duplicates: number }> {
  const { data } = await wx.getClipboardData()
  const { items, reviewLogs } = parseBackup(data || '')
  const { added, duplicates } = await repository.bulkAdd(items)
  for (const log of reviewLogs) {
    await repository.logReview({ itemId: log.itemId, at: log.at, rating: log.rating, box: log.box })
  }
  return { added: added.length, duplicates: duplicates.length }
}

export function backupFilename(): string {
  return `russian-backup-${dayKey()}.json`
}
