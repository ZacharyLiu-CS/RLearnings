/**
 * 录入页（小程序）：优先级 = 拍照 OCR → 手动（AI 补全）→ 批量粘贴。
 * 手动录入只要求用户给出俄语单词，其余字段由模型生成。
 */
import { enrichWord } from '../../core/ai'
import { getAiConfig, isAiConfigured } from '../../core/settings'
import { OCR_NOT_CONFIGURED, pickImage, recognizeFile } from '../../core/ocr'
import { repository } from '../../core/storage'
import { config } from '../../config'
import { createItem, parseBulkText } from '../../shared/item'
import type { LearningItem } from '../../shared/types'
import type { WordDraft } from '../../shared/ai'

const TABS = ['拍照 OCR', '手动录入', '批量粘贴']

const EMPTY_FORM = {
  ru: '',
  zh: '',
  pos: '',
  stress: '',
  forms: '',
  example: '',
  tags: '',
}

interface DraftRow {
  ru: string
  zh: string
  pos?: string
  example?: string
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

function splitWords(text: string): string[] {
  return text
    .split(/[\n,，;；]+/)
    .map((token) => token.trim())
    .filter(Boolean)
}

Page({
  data: {
    tabs: TABS,
    tabIndex: 0,
    editId: '',
    form: { ...EMPTY_FORM },
    // 手动（AI）
    aiText: '',
    aiWordCount: 0,
    aiDrafts: [] as WordDraft[],
    aiBusy: false,
    aiTip: '',
    aiConfigured: false,
    // 批量
    bulkText: '',
    bulkPreview: [] as Array<{ ru: string; zh: string }>,
    bulkCount: 0,
    // OCR
    ocrConfigured: Boolean(config.ocrEndpoint),
    ocrTip: '',
    ocrBusy: false,
    drafts: [] as DraftRow[],
  },

  onShow() {
    this.setData({ aiConfigured: isAiConfigured() })
  },

  onLoad(options) {
    if (options?.id) {
      this.setData({ editId: options.id, tabIndex: 1 })
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

  onGoSettings() {
    wx.navigateTo({ url: '/pages/settings/index' })
  },

  // ---------- 编辑已有词条 ----------
  onField(e: FieldEvent) {
    const field = e.currentTarget.dataset.field
    this.setData({ [`form.${field}`]: e.detail.value } as Record<string, string>)
  },

  async onSaveEdit() {
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
      tags: form.tags
        .split(/[,，]/)
        .map((tag) => tag.trim())
        .filter(Boolean),
    }
    await repository.patch(this.data.editId, payload)
    wx.showToast({ title: '已保存', icon: 'success' })
    wx.navigateBack()
  },

  // ---------- 手动录入（AI 补全）----------
  onAiText(e: FieldEvent) {
    const text = e.detail.value
    this.setData({ aiText: text, aiWordCount: splitWords(text).length })
  },

  async onAiEnrich() {
    const words = splitWords(this.data.aiText)
    if (!words.length) {
      wx.showToast({ title: '请输入俄语单词', icon: 'none' })
      return
    }
    if (!isAiConfigured()) {
      this.setData({ aiTip: '尚未配置 API Key，请先在「AI 设置」页填写 DeepSeek 的 Key。' })
      return
    }

    const aiConfig = getAiConfig()
    this.setData({ aiBusy: true, aiTip: `补全中…（0/${words.length}）` })
    const results: WordDraft[] = []
    try {
      // 顺序请求，避免触发限流
      for (let i = 0; i < words.length; i += 1) {
        const draft = await enrichWord(aiConfig, words[i])
        results.push(draft)
        this.setData({ aiTip: `补全中…（${i + 1}/${words.length}）` })
      }
      this.setData({
        aiDrafts: [...results, ...this.data.aiDrafts],
        aiText: '',
        aiWordCount: 0,
        aiTip: '',
      })
      wx.showToast({ title: `已补全 ${results.length} 条`, icon: 'success' })
    } catch (err) {
      this.setData({ aiTip: err instanceof Error ? err.message : 'AI 补全失败' })
    } finally {
      this.setData({ aiBusy: false })
    }
  },

  async onAiSavePlain() {
    const words = splitWords(this.data.aiText)
    if (!words.length) return
    await repository.bulkAdd(words.map((ru) => createItem({ ru }, 'manual')))
    wx.showToast({ title: `已存 ${words.length} 条原文`, icon: 'success' })
    this.setData({ aiText: '', aiWordCount: 0 })
  },

  onAiDraftField(e: FieldEvent) {
    const index = Number(e.currentTarget.dataset.index)
    const field = e.currentTarget.dataset.field
    this.setData({ [`aiDrafts[${index}].${field}`]: e.detail.value } as Record<string, string>)
  },

  onAiRemove(e: IndexEvent) {
    const index = Number(e.currentTarget.dataset.index)
    const next = [...this.data.aiDrafts]
    next.splice(index, 1)
    this.setData({ aiDrafts: next })
  },

  async onAiSave() {
    if (!this.data.aiDrafts.length) return
    const { added } = await repository.bulkAdd(
      this.data.aiDrafts.map((draft) =>
        createItem(
          {
            ru: draft.ru,
            zh: draft.zh,
            pos: draft.pos,
            stress: draft.stress,
            forms: draft.forms,
            example: draft.example,
            note: draft.note,
            tags: draft.tags,
          },
          'manual',
        ),
      ),
    )
    wx.showToast({ title: `已入库 ${added.length} 条`, icon: 'success' })
    this.setData({ aiDrafts: [] })
  },

  // ---------- 批量粘贴 ----------
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

  // ---------- 拍照 OCR ----------
  async onPickImage() {
    if (!config.ocrEndpoint) {
      this.setData({ ocrTip: '尚未配置 OCR 服务地址（miniprogram/config.ts），请改用手动录入。' })
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
            ? '未配置 OCR 服务地址，请改用手动录入。'
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
    this.setData({ [`drafts[${index}].selected`]: !this.data.drafts[index].selected } as Record<
      string,
      boolean
    >)
  },

  async onOcrAiEnrich() {
    const targets = this.data.drafts.filter((draft) => draft.selected && draft.ru.trim())
    if (!targets.length) {
      wx.showToast({ title: '请先勾选要补全的行', icon: 'none' })
      return
    }
    if (!isAiConfigured()) {
      wx.showToast({ title: '未配置 API Key', icon: 'none' })
      return
    }
    this.setData({ ocrBusy: true })
    try {
      const aiConfig = getAiConfig()
      for (const draft of this.data.drafts) {
        if (!draft.selected || !draft.ru.trim()) continue
        const result = await enrichWord(aiConfig, draft.ru)
        draft.ru = result.ru || draft.ru
        draft.zh = result.zh ?? ''
        draft.pos = result.pos
        draft.example = result.example
      }
      this.setData({ drafts: [...this.data.drafts] })
      wx.showToast({ title: `已补全 ${targets.length} 行`, icon: 'success' })
    } catch (err) {
      wx.showToast({ title: err instanceof Error ? err.message : 'AI 补全失败', icon: 'none' })
    } finally {
      this.setData({ ocrBusy: false })
    }
  },

  async onOcrSubmit() {
    const selected = this.data.drafts.filter((draft) => draft.selected && draft.ru.trim())
    if (!selected.length) {
      wx.showToast({ title: '请至少勾选一条', icon: 'none' })
      return
    }
    const { added } = await repository.bulkAdd(
      selected.map((draft) =>
        createItem(
          { ru: draft.ru.trim(), zh: draft.zh.trim() || undefined, pos: draft.pos, example: draft.example, tags: ['OCR'] },
          'ocr',
        ),
      ),
    )
    wx.showToast({ title: `已入库 ${added.length} 条`, icon: 'success' })
    this.setData({ drafts: [] })
  },
})
