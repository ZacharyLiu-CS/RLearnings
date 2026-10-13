import { DAY_MS } from '@/core/srs'

/** 本地日期键（YYYY-MM-DD），用于连续打卡统计 */
export function dayKey(date: Date | string = new Date()): string {
  const d = typeof date === 'string' ? new Date(date) : date
  const y = d.getFullYear()
  const m = `${d.getMonth() + 1}`.padStart(2, '0')
  const day = `${d.getDate()}`.padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function isoNow(): string {
  return new Date().toISOString()
}

export function addDaysIso(base: Date | string, days: number): string {
  const d = typeof base === 'string' ? new Date(base) : base
  return new Date(d.getTime() + days * DAY_MS).toISOString()
}

/** 最近 n 天的日期键数组（含今天，按时间正序） */
export function lastDays(n: number, from = new Date()): string[] {
  const out: string[] = []
  for (let i = n - 1; i >= 0; i -= 1) {
    out.push(dayKey(new Date(from.getTime() - i * DAY_MS)))
  }
  return out
}

export function formatDate(iso: string | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return `${d.getMonth() + 1}/${d.getDate()}`
}

export function formatRelativeDue(iso: string | undefined, now = new Date()): string {
  if (!iso) return '—'
  const diff = new Date(iso).getTime() - now.getTime()
  if (diff <= 0) return '待复习'
  const days = Math.round(diff / DAY_MS)
  if (days < 1) return `${Math.max(1, Math.round(diff / 3600_000))} 小时后`
  return `${days} 天后`
}
