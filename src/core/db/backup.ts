/**
 * 数据备份与恢复（Web 端）：本地全量导出（JSON）/ CSV 导出 / 导入合并。
 * CSV 编解码与条目工厂复用 shared 层，与小程序端保持一致。
 */
import { createItem } from '../../../shared/item'
import type { LearningItem, ReviewLog } from '../../../shared/types'

export { parseCsv, toCsv } from '../../../shared/item'

export const BACKUP_VERSION = 1

export interface BackupFile {
  version: number
  exportedAt: string
  items: LearningItem[]
  reviewLogs: ReviewLog[]
}

export function buildBackup(items: LearningItem[], reviewLogs: ReviewLog[]): BackupFile {
  return {
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    items,
    reviewLogs,
  }
}

export function downloadFile(filename: string, content: string, mime = 'application/json'): void {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  // 延迟释放，避免部分浏览器下载被中断
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** 解析导入文件，产出可直接入库的条目（自动补全默认值） */
export function parseBackup(text: string): { items: LearningItem[]; reviewLogs: ReviewLog[] } {
  const data = JSON.parse(text) as Partial<BackupFile> & { items?: LearningItem[] }
  const rawItems = Array.isArray(data) ? data : (data.items ?? [])
  const items = rawItems
    .filter((item): item is LearningItem => Boolean(item && typeof item.ru === 'string'))
    .map((item) => createItem(item))
  const reviewLogs = Array.isArray(data.reviewLogs) ? data.reviewLogs : []
  return { items, reviewLogs }
}
