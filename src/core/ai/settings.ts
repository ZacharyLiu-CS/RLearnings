/**
 * AI 配置：目前仅支持 DeepSeek（OpenAI 兼容协议）。
 * 配置保存在本地（localStorage），不会随学习数据同步或上传。
 */
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import {
  AI_PROVIDERS,
  DEFAULT_AI_CONFIG,
  MODEL_PRESETS,
  normalizeBaseUrl,
  type AiConfig,
} from '../../../shared/ai'

const STORAGE_KEY = 'rl.ai.config'

export const useAiStore = defineStore('ai', () => {
  const config = ref<AiConfig>({ ...DEFAULT_AI_CONFIG })
  const loaded = ref(false)
  const testing = ref(false)
  const testResult = ref<{ ok: boolean; message: string } | null>(null)

  const configured = computed(() => Boolean(config.value.apiKey.trim()))
  const modelLabel = computed(
    () => MODEL_PRESETS.find((preset) => preset.id === config.value.model)?.label ?? config.value.model,
  )
  const providerLabel = computed(
    () => AI_PROVIDERS.find((item) => item.id === config.value.provider)?.label ?? config.value.provider,
  )

  function load(): void {
    if (loaded.value) return
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) config.value = { ...DEFAULT_AI_CONFIG, ...(JSON.parse(raw) as Partial<AiConfig>) }
    } catch {
      /* 配置损坏时用默认值，不影响主流程 */
    }
    loaded.value = true
  }

  function save(patch: Partial<AiConfig>): void {
    config.value = { ...config.value, ...patch, baseUrl: normalizeBaseUrl(patch.baseUrl ?? config.value.baseUrl) }
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(config.value))
    } catch {
      /* 隐私模式下写入失败：配置仅在当前会话有效 */
    }
    testResult.value = null
  }

  function reset(): void {
    config.value = { ...DEFAULT_AI_CONFIG }
    try {
      localStorage.removeItem(STORAGE_KEY)
    } catch {
      /* ignore */
    }
    testResult.value = null
  }

  return {
    config,
    loaded,
    testing,
    testResult,
    configured,
    modelLabel,
    providerLabel,
    load,
    save,
    reset,
    setTesting(value: boolean) {
      testing.value = value
    },
    setTestResult(result: { ok: boolean; message: string } | null) {
      testResult.value = result
    },
  }
})
