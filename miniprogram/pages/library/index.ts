/**
 * 词库页：搜索 / 筛选 + 窗口化长列表（万级数据只渲染视口内行）。
 * 列表渲染只依赖索引，正文仅在进入视口时反序列化。
 */
import { repository } from '../../core/storage'
import type { ItemIndex, ItemQuery, LearningItem, SrsStatus } from '../../shared/types'
import { formatRelativeDue } from '../../shared/utils/date'

const ROW_HEIGHT = 76
const OVERSCAN = 6

const STATUS_RANGE = ['全部状态', '新学', '学习中', '复习中', '已掌握']
const STATUS_VALUES: Array<ItemQuery['status']> = ['all', 'new', 'learning', 'reviewing', 'mastered']
const TYPE_RANGE = ['全部类型', '单词', '句子']
const TYPE_VALUES: Array<ItemQuery['type']> = ['all', 'word', 'sentence']

interface Row {
  id: string
  ru: string
  zh: string
  pos: string
  tags: string[]
  status: SrsStatus
  box: number
  dueText: string
  starred: boolean
  source: string
}

interface DetailEvent<T> {
  detail: T
}

/** 非响应式数据放模块作用域，避免每次 setData 序列化大数组 */
let list: ItemIndex[] = []
let scrollTop = 0
let viewportHeight = 600
let keywordTimer = 0
let scrollTimer = 0

function toRow(item: LearningItem): Row {
  return {
    id: item.id,
    ru: item.ru,
    zh: item.zh ?? '',
    pos: item.pos ?? '',
    tags: item.tags,
    status: item.srs.status,
    box: item.srs.box,
    dueText: formatRelativeDue(item.srs.nextReview),
    starred: item.starred,
    source: item.source.module,
  }
}

Page({
  data: {
    keyword: '',
    statusRange: STATUS_RANGE,
    statusIndex: 0,
    typeRange: TYPE_RANGE,
    typeIndex: 0,
    starredOnly: false,
    rows: [] as Row[],
    total: 0,
    offsetY: 0,
    listHeight: 0,
    loading: true,
  },

  onLoad() {
    const info = wx.getSystemInfoSync()
    viewportHeight = info.windowHeight || 600
  },

  onShow() {
    void this.reload()
  },

  async reload() {
    this.setData({ loading: true })
    const query: ItemQuery = {
      keyword: this.data.keyword,
      status: STATUS_VALUES[this.data.statusIndex],
      type: TYPE_VALUES[this.data.typeIndex],
      starredOnly: this.data.starredOnly,
    }
    list = repository.pageIndex(query)
    this.setData({
      total: list.length,
      listHeight: list.length * ROW_HEIGHT,
      loading: false,
    })
    await this.renderWindow(0)
  },

  async renderWindow(top: number) {
    const start = Math.max(0, Math.floor(top / ROW_HEIGHT) - OVERSCAN)
    const end = Math.min(list.length, Math.ceil((top + viewportHeight) / ROW_HEIGHT) + OVERSCAN)
    const slice = list.slice(start, end)
    const items = await Promise.all(slice.map((entry) => repository.get(entry.id)))
    const rows = items.filter((item): item is LearningItem => Boolean(item)).map(toRow)
    this.setData({ rows, offsetY: start * ROW_HEIGHT })
  },

  onScroll(e: DetailEvent<{ scrollTop: number }>) {
    scrollTop = e.detail.scrollTop
    if (scrollTimer) return
    // 节流：一帧内只渲染一次，滚动保持流畅
    scrollTimer = setTimeout(() => {
      scrollTimer = 0
      void this.renderWindow(scrollTop)
    }, 16) as unknown as number
  },

  onKeyword(e: DetailEvent<{ value: string }>) {
    this.setData({ keyword: e.detail.value })
    clearTimeout(keywordTimer)
    keywordTimer = setTimeout(() => void this.reload(), 250) as unknown as number
  },

  onStatusChange(e: DetailEvent<{ value: string }>) {
    this.setData({ statusIndex: Number(e.detail.value) })
    void this.reload()
  },

  onTypeChange(e: DetailEvent<{ value: string }>) {
    this.setData({ typeIndex: Number(e.detail.value) })
    void this.reload()
  },

  onToggleStarred() {
    this.setData({ starredOnly: !this.data.starredOnly })
    void this.reload()
  },

  async onStar(e: DetailEvent<{ id: string }>) {
    const id = e.detail.id
    const entry = list.find((row) => row.id === id)
    if (!entry) return
    await repository.patch(id, { starred: !entry.starred })
    wx.vibrateShort({ type: 'light', fail: () => undefined })
    await this.reload()
  },

  onRemove(e: DetailEvent<{ id: string }>) {
    const id = e.detail.id
    wx.showModal({
      title: '删除词条',
      content: '删除后不可恢复，确认继续？',
      success: (res) => {
        if (!res.confirm) return
        void repository.remove([id]).then(() => {
          wx.showToast({ title: '已删除', icon: 'success' })
          return this.reload()
        })
      },
    })
  },

  onEdit(e: DetailEvent<{ id: string }>) {
    wx.navigateTo({ url: `/pages/add/index?id=${e.detail.id}` })
  },

  onAdd() {
    wx.navigateTo({ url: '/pages/add/index' })
  },
})
