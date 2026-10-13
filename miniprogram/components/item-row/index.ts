import type { SrsStatus } from '../../shared/types'

interface RowItem {
  id: string
  ru: string
  zh?: string
  pos?: string
  tags: string[]
  status: SrsStatus
  box: number
  dueText: string
  starred: boolean
  source: string
}

const STATUS_TEXT: Record<SrsStatus, string> = {
  new: '新学',
  learning: '学习中',
  reviewing: '复习中',
  mastered: '已掌握',
}

Component({
  properties: {
    item: {
      type: Object,
      value: {},
    },
  },

  data: {
    statusText: '',
  },

  lifetimes: {
    attached() {
      const item = this.data.item as RowItem
      this.setData({ statusText: item?.status ? STATUS_TEXT[item.status] : '' })
    },
  },

  methods: {
    onStar() {
      const item = this.data.item as RowItem
      this.triggerEvent('star', { id: item.id })
    },
    onRemove() {
      const item = this.data.item as RowItem
      this.triggerEvent('remove', { id: item.id })
    },
    onTap() {
      const item = this.data.item as RowItem
      this.triggerEvent('edit', { id: item.id })
    },
  },
})
