/**
 * AI 配置（小程序端）：保存在 wx.Storage，仅本机生效。
 * 目前仅支持 DeepSeek（OpenAI 兼容协议）。
 */
import { DEFAULT_AI_CONFIG, normalizeBaseUrl, type AiConfig } from '../shared/ai'

const STORAGE_KEY = 'rl.ai.config'

let cache: AiConfig | null = null

export function getAiConfig(): AiConfig {
  if (cache) return cache
  const stored = wx.getStorageSync<Partial<AiConfig>>(STORAGE_KEY)
  cache = {
    ...DEFAULT_AI_CONFIG,
    ...(stored && typeof stored === 'object' ? stored : {}),
    baseUrl: normalizeBaseUrl(stored?.baseUrl ?? DEFAULT_AI_CONFIG.baseUrl),
  }
  return cache
}

export function saveAiConfig(patch: Partial<AiConfig>): AiConfig {
  const next: AiConfig = {
    ...getAiConfig(),
    ...patch,
    baseUrl: normalizeBaseUrl(patch.baseUrl ?? getAiConfig().baseUrl),
  }
  cache = next
  wx.setStorageSync(STORAGE_KEY, next)
  return next
}

export function clearAiConfig(): void {
  cache = { ...DEFAULT_AI_CONFIG }
  wx.removeStorageSync(STORAGE_KEY)
}

export function isAiConfigured(): boolean {
  return Boolean(getAiConfig().apiKey.trim())
}
