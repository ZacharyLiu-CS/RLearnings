/**
 * 数据备份与恢复：本地全量导出（JSON）/ CSV 导出 / 导入合并。
 * 兜底方案：即使同步服务不可用，用户数据也不会丢。
 */
import { createItem } from '@/core/db/repository'
import type { LearningItem, ReviewLog } from '@/core/types'

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

const CSV_COLUMNS = ['ru', 'stress', 'pos', 'zh', 'forms', 'example', 'tags', 'note'] as const

function escapeCsv(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value
}

export function toCsv(items: LearningItem[]): string {
  const header = CSV_COLUMNS.join(',')
  const rows = items.map((item) =>
    CSV_COLUMNS.map((key) => {
      const value = key === 'tags' ? item.tags.join('|') : (item[key] ?? '')
      return escapeCsv(String(value))
    }).join(','),
  )
  return [header, ...rows].join('\n')
}

export function parseCsv(text: string): Array<Partial<LearningItem>> {
  const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0)
  if (lines.length < 2) return []
  const header = lines[0].split(',').map((cell) => cell.trim())
  const out: Array<Partial<LearningItem>> = []
  for (const line of lines.slice(1)) {
    const cells = line.match(/("([^"]|"")*"|[^,]*)(,|$)/g) ?? []
    const row: Record<string, string> = {}
    header.forEach((key, index) => {
      const raw = (cells[index] ?? '').replace(/,$/, '').trim()
      row[key] = raw.replace(/^"(.*)"$/s, (_, inner: string) => inner.replace(/""/g, '"'))
    })
    if (!row.ru) continue
    out.push({
      ru: row.ru,
      stress: row.stress,
      pos: row.pos,
      zh: row.zh,
      forms: row.forms,
      example: row.example,
      note: row.note,
      tags: (row.tags ?? '').split('|').map((t) => t.trim()).filter(Boolean),
    })
  }
  return out
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
