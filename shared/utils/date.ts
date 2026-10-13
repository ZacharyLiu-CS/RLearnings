/** 日期工具（跨平台共享） */
import { DAY_MS } from '../srs'

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

export function lastDays(n: number, from: Date = new Date()): string[] {
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

export function formatRelativeDue(iso: string | undefined, now: Date = new Date()): string {
  if (!iso) return '—'
  const diff = new Date(iso).getTime() - now.getTime()
  if (diff <= 0) return '待复习'
  const days = Math.round(diff / DAY_MS)
  if (days < 1) return `${Math.max(1, Math.round(diff / 3600_000))} 小时后`
  return `${days} 天后`
}

/** 连续打卡天数：以复习日志的日期集合计算 */
export function calcStreak(activeDays: Iterable<string>, from: Date = new Date()): number {
  const active = new Set(activeDays)
  const cursor = new Date(from)
  if (!active.has(dayKey(cursor))) cursor.setDate(cursor.getDate() - 1)
  let days = 0
  while (active.has(dayKey(cursor))) {
    days += 1
    cursor.setDate(cursor.getDate() - 1)
  }
  return days
}
