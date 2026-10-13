/**
 * 统计页：仪表盘 + 7 天复习曲线 + 掌握分布 + 数据管理（剪贴板导入导出）。
 */
import { exportCsvToClipboard, exportJsonToClipboard, importFromClipboard } from '../../core/backup'
import { repository } from '../../core/storage'
import { config } from '../../config'
import { createItem } from '../../shared/item'
import { addDaysIso, calcStreak, dayKey, lastDays } from '../../shared/utils/date'
import type { SrsStatus } from '../../shared/types'

const STATUS_ROWS: Array<{ key: SrsStatus; label: string; color: string }> = [
  { key: 'new', label: '新学', color: '#9db8ff' },
  { key: 'learning', label: '学习中', color: '#ffb020' },
  { key: 'reviewing', label: '复习中', color: '#7ee0c0' },
  { key: 'mastered', label: '已掌握', color: '#3ecf8e' },
]

const DEMO_WORDS: Array<[string, string, string]> = [
  ['дом', '房子', 'noun'],
  ['книга', '书', 'noun'],
  ['говорить', '说', 'verb'],
  ['учебник', '课本', 'noun'],
  ['красивый', '美丽的', 'adj'],
  ['город', '城市', 'noun'],
  ['работа', '工作', 'noun'],
  ['время', '时间', 'noun'],
  ['язык', '语言', 'noun'],
  ['слово', '单词', 'noun'],
]

interface CurvePoint {
  day: string
  count: number
  percent: number
}

interface DistRow {
  label: string
  count: number
  percent: number
  color: string
}

Page({
  data: {
    total: 0,
    due: 0,
    mastered: 0,
    streak: 0,
    storageKb: 0,
    curve: [] as CurvePoint[],
    dist: [] as DistRow[],
  },

  onShow() {
    void this.load()
  },

  async load() {
    const [counts, logs] = await Promise.all([
      repository.statusCounts(),
      repository.reviewStats(addDaysIso(new Date(), -30)),
    ])

    const days = lastDays(7)
    const counter = new Map<string, number>()
    for (const log of logs) {
      const key = dayKey(log.at)
      counter.set(key, (counter.get(key) ?? 0) + 1)
    }
    const max = Math.max(1, ...days.map((day) => counter.get(day) ?? 0))
    const curve: CurvePoint[] = days.map((day) => {
      const count = counter.get(day) ?? 0
      return { day: day.slice(5), count, percent: Math.round((count / max) * 100) }
    })

    const dist: DistRow[] = STATUS_ROWS.map((row) => {
      const count = counts.byStatus[row.key] ?? 0
      return {
        label: row.label,
        count,
        percent: Math.round((count / Math.max(1, counts.total)) * 100),
        color: row.color,
      }
    })

    this.setData({
      total: counts.total,
      due: counts.due,
      mastered: counts.byStatus.mastered ?? 0,
      streak: calcStreak(new Set(logs.map((log) => dayKey(log.at)))),
      storageKb: repository.estimateSizeKb(),
      curve,
      dist,
    })
  },

  async onExportJson() {
    const count = await exportJsonToClipboard()
    wx.showToast({ title: `已复制 ${count} 条备份`, icon: 'none' })
  },

  async onExportCsv() {
    const count = await exportCsvToClipboard()
    wx.showToast({ title: `已复制 ${count} 条 CSV`, icon: 'none' })
  },

  onImport() {
    wx.showModal({
      title: '从剪贴板导入',
      content: '将解析剪贴板中的备份 JSON 并合并入库（重复条目自动跳过）。',
      success: (res) => {
        if (!res.confirm) return
        void importFromClipboard()
          .then(({ added, duplicates }) => {
            wx.showToast({ title: `新增 ${added}，跳过 ${duplicates}`, icon: 'none' })
            return this.load()
          })
          .catch(() => wx.showToast({ title: '导入失败：剪贴板不是合法备份', icon: 'none' }))
      },
    })
  },

  onSeed() {
    wx.showModal({
      title: '生成演示数据',
      content: `将写入 ${config.demoSeedSize} 条演示词条，用于验证列表性能。`,
      success: (res) => {
        if (!res.confirm) return
        const drafts = Array.from({ length: config.demoSeedSize }, (_unused, i) => {
          const [ru, zh, pos] = DEMO_WORDS[i % DEMO_WORDS.length]
          const round = Math.floor(i / DEMO_WORDS.length)
          return createItem(
            { ru: round === 0 ? ru : `${ru}${round}`, zh, pos, tags: ['演示'] },
            'manual',
          )
        })
        void repository
          .bulkAdd(drafts)
          .then(({ added }) => {
            wx.showToast({ title: `已生成 ${added.length} 条`, icon: 'success' })
            return this.load()
          })
          .catch(() => wx.showToast({ title: '存储空间不足', icon: 'none' }))
      },
    })
  },

  onClear() {
    wx.showModal({
      title: '清空数据',
      content: '将清除本机全部词条与复习记录，不可恢复。',
      confirmColor: '#ff5c5c',
      success: (res) => {
        if (!res.confirm) return
        void repository.clearAll().then(() => {
          wx.showToast({ title: '已清空', icon: 'none' })
          return this.load()
        })
      },
    })
  },
})
