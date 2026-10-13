/**
 * 条目工具（跨平台共享）：默认字段补全、查重键、查询匹配、排序、索引投影。
 * Web（IndexedDB）与小程序（Storage）共用，保证筛选与去重规则一致。
 */
import { createSrs } from './srs'
import type {
  FilterableItem,
  ItemIndex,
  ItemQuery,
  ItemSourceModule,
  LearningItem,
} from './types'
import { createId } from './utils/id'
import { isoNow } from './utils/date'

export function normalize(value: string | undefined): string {
  return (value ?? '').trim().toLowerCase()
}

export function dedupeKey(item: Pick<LearningItem, 'ru' | 'zh'>): string {
  return `${normalize(item.ru)}|${normalize(item.zh)}`
}

export function matches(item: FilterableItem, query: ItemQuery): boolean {
  if (query.status && query.status !== 'all' && item.srs.status !== query.status) return false
  if (query.type && query.type !== 'all' && item.type !== query.type) return false
  if (query.starredOnly && !item.starred) return false
  if (query.tag && !item.tags.includes(query.tag)) return false
  if (query.source && query.source !== 'all' && item.source.module !== query.source) return false
  const keyword = normalize(query.keyword)
  if (keyword) {
    const haystack = normalize(
      [item.ru, item.zh, item.pos, item.forms, item.note, item.tags.join(' ')].join(' '),
    )
    if (!haystack.includes(keyword)) return false
  }
  return true
}

export function sortByCreatedDesc<T extends { createdAt: string }>(items: T[]): T[] {
  return items.sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0))
}

export function toIndex(item: LearningItem): ItemIndex {
  return {
    id: item.id,
    type: item.type,
    ru: item.ru,
    zh: item.zh,
    pos: item.pos,
    tags: item.tags,
    source: item.source,
    srs: item.srs,
    starred: item.starred,
    createdAt: item.createdAt,
  }
}

export function createItem(
  input: Partial<LearningItem> & { ru: string },
  source?: ItemSourceModule,
): LearningItem {
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
    source: input.source ?? { module: source ?? 'manual' },
    srs: input.srs ?? createSrs('new', new Date(now)),
    starred: input.starred ?? false,
    createdAt: input.createdAt ?? now,
  }
}

/**
 * 批量粘贴解析：支持 `ru - zh` / `ru = zh` / `ru, zh` / `ru<Tab>zh` / 纯俄语行。
 */
export function parseBulkText(text: string): Array<{ ru: string; zh?: string }> {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const parts = line.split(/\s*(?:-{1,2}|=|,|，|\t)\s*/)
      const [ru, ...rest] = parts
      return { ru: (ru ?? '').trim(), zh: rest.join(' ').trim() || undefined }
    })
    .filter((draft) => draft.ru)
}

/** CSV 导出/解析（跨平台共享，用于备份） */
const CSV_COLUMNS = ['ru', 'stress', 'pos', 'zh', 'forms', 'example', 'tags', 'note'] as const

function escapeCsv(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value
}

export function toCsv(items: LearningItem[]): string {
  const rows = items.map((item) =>
    CSV_COLUMNS.map((key) => {
      const value = key === 'tags' ? item.tags.join('|') : (item[key] ?? '')
      return escapeCsv(String(value))
    }).join(','),
  )
  return [CSV_COLUMNS.join(','), ...rows].join('\n')
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
      row[key] = raw.replace(/^"(.*)"$/s, (_all, inner: string) => inner.replace(/""/g, '"'))
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
      tags: (row.tags ?? '')
        .split('|')
        .map((tag) => tag.trim())
        .filter(Boolean),
    })
  }
  return out
}
