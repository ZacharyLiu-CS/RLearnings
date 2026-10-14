/**
 * 复习页：使用与 Web 端完全相同的 SRS 调度器（shared/srs）。
 * 进度用 Apple 运动圆环呈现，满环时给出震动 + 奖励卡片。
 */
import { repository } from '../../core/storage'
import { srs } from '../../shared/srs'
import { addDaysIso, calcStreak, dayKey, isoNow } from '../../shared/utils/date'
import type { LearningItem, Rating } from '../../shared/types'

const LIMIT = 80

interface Card {
  id: string
  ru: string
  /** 俄文按词拆分，用于逐词晕染 */
  ruTokens: string[]
  stress: string
  zh: string
  forms: string
  example: string
  tags: string[]
}

let queue: LearningItem[] = []
let index = 0
let graded = 0

function toCard(item: LearningItem): Card {
  return {
    id: item.id,
    ru: item.ru,
    ruTokens: item.ru.split(/\s+/).filter(Boolean),
    stress: item.stress ?? '',
    zh: item.zh ?? '（暂无释义）',
    forms: item.forms ?? '',
    example: item.example ?? '',
    tags: item.tags,
  }
}

Page({
  data: {
    card: null as Card | null,
    flipped: false,
    remaining: 0,
    total: 0,
    /** 圆环进度 0 - 1 */
    progress: 0,
    percent: 0,
    graded: 0,
    finished: false,
    loading: true,
    streak: 0,
    /** 用于通过 a/b 类名交替重播入场动画 */
    tick: 0,
  },

  onShow() {
    if (!queue.length) void this.load()
  },

  async load() {
    this.setData({ loading: true })
    const [items, logs] = await Promise.all([
      repository.due(isoNow(), LIMIT),
      repository.reviewStats(addDaysIso(new Date(), -60)),
    ])
    queue = items.sort(() => Math.random() - 0.5)
    index = 0
    graded = 0
    this.setData({
      total: queue.length,
      finished: false,
      graded: 0,
      loading: false,
      streak: calcStreak(new Set(logs.map((log) => dayKey(log.at)))),
    })
    this.render()
  },

  render() {
    const item = queue[index]
    const progress = queue.length ? Math.min(1, index / queue.length) : 0
    const finished = !item && queue.length > 0

    if (finished && !this.data.finished) {
      // 满环：给一次明确的触感反馈
      wx.vibrateShort({ type: 'heavy', fail: () => undefined })
    }

    this.setData({
      card: item ? toCard(item) : null,
      flipped: false,
      remaining: queue.length - index,
      progress,
      percent: Math.round(progress * 100),
      finished,
      tick: this.data.tick + 1,
    })
  },

  onFlip() {
    this.setData({ flipped: !this.data.flipped })
  },

  async grade(rating: Rating) {
    const item = queue[index]
    if (!item) return
    const next = srs.schedule(item.srs, rating)
    const updated: LearningItem = { ...item, srs: next }

    queue[index] = updated
    // 不认识：归零并当日重现（移到队尾）
    if (rating === 'unknown') queue.push(updated)
    index += 1
    graded += 1

    // 先更新界面（圆环立即前进），再落库
    this.setData({ graded })
    this.render()
    await repository.patch(item.id, { srs: next })
    await repository.logReview({ itemId: item.id, at: isoNow(), rating, box: next.box })
  },

  onKnown() {
    void this.grade('known')
  },

  onFuzzy() {
    void this.grade('fuzzy')
  },

  onUnknown() {
    void this.grade('unknown')
  },

  onReload() {
    queue = []
    void this.load()
  },

  onGoLibrary() {
    wx.switchTab({ url: '/pages/library/index' })
  },
})
