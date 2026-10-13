/**
 * 录入页：手动 / 批量粘贴 / 拍照 OCR，并支持编辑已有词条（?id=）。
 */
import { config } from '../../config'
import { OCR_NOT_CONFIGURED, pickImage, recognizeFile } from '../../core/ocr'
import { repository } from '../../core/storage'
import { createItem, parseBulkText } from '../../shared/item'
import type { LearningItem } from '../../shared/types'

const TABS = ['手动', '批量', '拍照 OCR']

const EMPTY_FORM = {
  ru: '',
  zh: '',
  pos: '',
  stress: '',
  forms: '',
  example: '',
  tags: '',
}

interface Draft {
  ru: string
  zh: string
  selected: boolean
  low: boolean
}

interface FieldEvent {
  detail: { value: string }
  currentTarget: { dataset: { field: string; index?: string } }
}

interface IndexEvent {
  currentTarget: { dataset: { index: string } }
}

function splitTags(value: string): string[] {
  return value
    .split(/[,，]/)
    .map((tag) => tag.trim())
    .filter(Boolean)
}

Page({
  data: {
    tabs: TABS,
    tabIndex: 0,
    editId: '',
    form: { ...EMPTY_FORM },
    bulkText: '',
    bulkPreview: [] as Array<{ ru: string; zh: string }>,
    bulkCount: 0,
    ocrConfigured: Boolean(config.ocrEndpoint),
    ocrTip: '',
    ocrBusy: false,
    drafts: [] as Draft[],
  },

  onLoad(options) {
    if (options?.id) {
      this.setData({ editId: options.id })
      void this.loadForEdit(options.id)
    }
  },

  async loadForEdit(id: string) {
    const item = await repository.get(id)
    if (!item) return
    this.setData({
      form: {
        ru: item.ru,
        zh: item.zh ?? '',
        pos: item.pos ?? '',
        stress: item.stress ?? '',
        forms: item.forms ?? '',
        example: item.example ?? '',
        tags: item.tags.join(', '),
      },
    })
  },

  onTab(e: IndexEvent) {
    this.setData({ tabIndex: Number(e.currentTarget.dataset.index) })
  },

  onField(e: FieldEvent) {
    const field = e.currentTarget.dataset.field
    this.setData({ [`form.${field}`]: e.detail.value } as Record<string, string>)
  },

  async onSave() {
    const form = this.data.form
    if (!form.ru.trim()) {
      wx.showToast({ title: '请填写俄语原文', icon: 'none' })
      return
    }
    const payload: Partial<LearningItem> & { ru: string } = {
      ru: form.ru.trim(),
      zh: form.zh.trim() || undefined,
      pos: form.pos.trim() || undefined,
      stress: form.stress.trim() || undefined,
      forms: form.forms.trim() || undefined,
      example: form.example.trim() || undefined,
      tags: splitTags(form.tags),
    }

    if (this.data.editId) {
      await repository.patch(this.data.editId, payload)
      wx.showToast({ title: '已保存', icon: 'success' })
      wx.navigateBack()
      return
    }

    const { added } = await repository.bulkAdd([createItem(payload, 'manual')])
    wx.showToast({ title: added.length ? '已入库' : '重复，已跳过', icon: added.length ? 'success' : 'none' })
    if (added.length) this.setData({ form: { ...EMPTY_FORM } })
  },

  onBulkText(e: FieldEvent) {
    const text = e.detail.value
    const parsed = parseBulkText(text)
    this.setData({
      bulkText: text,
      bulkCount: parsed.length,
      bulkPreview: parsed.slice(0, 8).map((draft) => ({ ru: draft.ru, zh: draft.zh ?? '—' })),
    })
  },

  async onBulkSubmit() {
    const parsed = parseBulkText(this.data.bulkText)
    if (!parsed.length) {
      wx.showToast({ title: '没有可导入的内容', icon: 'none' })
      return
    }
    const { added, duplicates } = await repository.bulkAdd(
      parsed.map((draft) => createItem({ ...draft, tags: [] }, 'manual')),
    )
    wx.showToast({
      title: duplicates.length ? `入库 ${added.length}，跳过 ${duplicates.length}` : `已入库 ${added.length} 条`,
      icon: 'success',
    })
    this.setData({ bulkText: '', bulkPreview: [], bulkCount: 0 })
  },

  async onPickImage() {
    if (!config.ocrEndpoint) {
      this.setData({ ocrTip: '尚未配置 OCR 服务地址（miniprogram/config.ts），请先用手动或批量录入。' })
      return
    }
    this.setData({ ocrBusy: true, ocrTip: '识别中…' })
    try {
      const filePath = await pickImage()
      const lines = await recognizeFile(filePath)
      if (!lines.length) {
        this.setData({ ocrTip: '没有识别到文字，可换一张更清晰的图片，或改用手动录入。' })
        return
      }
      // 低置信度行标黄，人工确认后再入库（ё/е、и/й 易混淆）
      this.setData({
        drafts: lines.map((line) => ({
          ru: line.text,
          zh: '',
          selected: true,
          low: line.confidence < 70,
        })),
        ocrTip: '',
      })
    } catch (err) {
      const code = (err as Error & { code?: string }).code
      this.setData({
        ocrTip:
          code === OCR_NOT_CONFIGURED
            ? '未配置 OCR 服务地址，请先用手动或批量录入。'
            : `识别失败：${(err as Error).message}。可改用手动录入。`,
      })
    } finally {
      this.setData({ ocrBusy: false })
    }
  },

  onDraftField(e: FieldEvent) {
    const index = Number(e.currentTarget.dataset.index)
    const field = e.currentTarget.dataset.field
    this.setData({ [`drafts[${index}].${field}`]: e.detail.value } as Record<string, string>)
  },

  onDraftToggle(e: IndexEvent) {
    const index = Number(e.currentTarget.dataset.index)
    const current = this.data.drafts[index]
    this.setData({ [`drafts[${index}].selected`]: !current.selected } as Record<string, boolean>)
  },

  async onOcrSubmit() {
    const selected = this.data.drafts.filter((draft) => draft.selected && draft.ru.trim())
    if (!selected.length) {
      wx.showToast({ title: '请至少勾选一条', icon: 'none' })
      return
    }
    const { added } = await repository.bulkAdd(
      selected.map((draft) =>
        createItem({ ru: draft.ru.trim(), zh: draft.zh.trim() || undefined, tags: ['OCR'] }, 'ocr'),
      ),
    )
    wx.showToast({ title: `已入库 ${added.length} 条`, icon: 'success' })
    this.setData({ drafts: [] })
  },

  onFillSample() {
    this.setData({
      bulkText: 'дом - 房子\nкнига = 书\nязык, 语言',
      bulkCount: 3,
      bulkPreview: [
        { ru: 'дом', zh: '房子' },
        { ru: 'книга', zh: '书' },
        { ru: 'язык', zh: '语言' },
      ],
    })
  },
})
