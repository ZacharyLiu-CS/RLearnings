/**
 * AI 配置页（小程序）：填写 DeepSeek 的 API Key / 接口地址 / 模型。
 * 配置只保存在本机 Storage，不会随备份导出。
 */
import { testConnection } from '../../core/ai'
import { clearAiConfig, getAiConfig, saveAiConfig } from '../../core/settings'
import { DEFAULT_AI_CONFIG, MODEL_PRESETS, type AiConfig } from '../../shared/ai'

const MODEL_LABELS = [...MODEL_PRESETS.map((preset) => preset.label), '自定义模型名…']

interface FieldEvent {
  detail: { value: string }
}

interface DetailEvent<T> {
  detail: T
}

Page({
  data: {
    form: { ...DEFAULT_AI_CONFIG } as AiConfig,
    modelLabels: MODEL_LABELS,
    modelIndex: 0,
    customModel: false,
    showKey: false,
    testing: false,
    result: '',
    resultOk: true,
    saved: false,
  },

  onShow() {
    const config = getAiConfig()
    const presetIndex = MODEL_PRESETS.findIndex((preset) => preset.id === config.model)
    const isCustom = presetIndex < 0 && Boolean(config.model)
    this.setData({
      form: { ...config },
      modelIndex: isCustom ? MODEL_PRESETS.length : Math.max(0, presetIndex),
      customModel: isCustom,
      result: '',
      saved: false,
    })
  },

  onKey(e: FieldEvent) {
    this.setData({ 'form.apiKey': e.detail.value } as Record<string, string>)
  },

  onBase(e: FieldEvent) {
    this.setData({ 'form.baseUrl': e.detail.value } as Record<string, string>)
  },

  onCustomModel(e: FieldEvent) {
    this.setData({ 'form.model': e.detail.value } as Record<string, string>)
  },

  onModelChange(e: DetailEvent<{ value: string }>) {
    const index = Number(e.detail.value)
    if (index >= MODEL_PRESETS.length) {
      this.setData({ modelIndex: index, customModel: true, 'form.model': '' } as Record<string, unknown>)
      return
    }
    this.setData({
      modelIndex: index,
      customModel: false,
      'form.model': MODEL_PRESETS[index].id,
    } as Record<string, unknown>)
  },

  onToggleKey() {
    this.setData({ showKey: !this.data.showKey })
  },

  async onTest() {
    if (!this.data.form.apiKey.trim()) {
      this.setData({ result: '请先填写 API Key', resultOk: false })
      return
    }
    this.setData({ testing: true, result: '测试中…', resultOk: true })
    try {
      const message = await testConnection(this.data.form)
      this.setData({ result: message, resultOk: true, testing: false })
    } catch (err) {
      this.setData({
        result: err instanceof Error ? err.message : '连接失败',
        resultOk: false,
        testing: false,
      })
    }
  },

  onSave() {
    saveAiConfig(this.data.form)
    this.setData({ saved: true, result: '配置已保存到本机', resultOk: true })
    wx.showToast({ title: '已保存', icon: 'success' })
  },

  onClear() {
    wx.showModal({
      title: '清除配置',
      content: '将删除本机保存的 API Key 与模型配置。',
      success: (res) => {
        if (!res.confirm) return
        clearAiConfig()
        this.onShow()
        wx.showToast({ title: '已清除', icon: 'none' })
      },
    })
  },
})
