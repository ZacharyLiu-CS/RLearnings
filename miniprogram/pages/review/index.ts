/**
 * 复习页：使用与 Web 端完全相同的 SRS 调度器（shared/srs）。
 * 小程序没有键盘事件，交互改为点击卡片翻面 + 三档按钮评分。
 */
import { repository } from '../../core/storage'
import { srs } from '../../shared/srs'
import { isoNow } from '../../shared/utils/date'
import type { LearningItem, Rating } from '../../shared/types'

const LIMIT = 80

interface Card {
  id: string
  ru: string
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
    progress: 0,
    graded: 0,
    finished: false,
    loading: true,
  },

  onShow() {
    if (!queue.length) void this.load()
  },

  async load() {
    this.setData({ loading: true })
    const items = await repository.due(isoNow(), LIMIT)
    queue = items.sort(() => Math.random() - 0.5)
    index = 0
    graded = 0
    this.setData({ total: queue.length, finished: false, graded: 0, loading: false })
    this.render()
  },

  render() {
    const item = queue[index]
    if (!item) {
      this.setData({ card: null, finished: true, remaining: 0, progress: 100 })
      return
    }
    this.setData({
      card: toCard(item),
      flipped: false,
      remaining: queue.length - index,
      progress: Math.round((index / Math.max(1, queue.length)) * 100),
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

    // 先更新界面，再落库；失败不影响继续复习
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
