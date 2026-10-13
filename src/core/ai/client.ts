/**
 * AI 客户端（Web / fetch）：调用 OpenAI 兼容的 /chat/completions 补全词条。
 */
import {
  buildChatBody,
  buildChatHeaders,
  chatCompletionsUrl,
  describeAiError,
  extractChatContent,
  parseWordResult,
  type AiConfig,
  type WordDraft,
} from '../../../shared/ai'

export class AiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message)
    this.name = 'AiError'
  }
}

export async function testConnection(config: AiConfig, signal?: AbortSignal): Promise<string> {
  if (!config.apiKey.trim()) throw new AiError('请先填写 API Key', 0)
  const url = chatCompletionsUrl(config.baseUrl)
  if (!url) throw new AiError('请填写接口地址', 0)

  const response = await fetch(url, {
    method: 'POST',
    signal,
    headers: buildChatHeaders(config.apiKey),
    body: JSON.stringify({
      model: config.model,
      messages: [{ role: 'user', content: '回复 OK 两个字' }],
      max_tokens: 8,
    }),
  })
  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    throw new AiError(describeAiError(response.status, detail.slice(0, 120)), response.status)
  }
  return '连接正常'
}

/** 只给一个俄语单词，返回补全后的词条草稿 */
export async function enrichWord(
  config: AiConfig,
  ru: string,
  context?: string,
  signal?: AbortSignal,
): Promise<WordDraft> {
  if (!config.apiKey.trim()) throw new AiError('未配置 API Key', 0)
  const url = chatCompletionsUrl(config.baseUrl)
  if (!url) throw new AiError('未配置接口地址', 0)

  const response = await fetch(url, {
    method: 'POST',
    signal,
    headers: buildChatHeaders(config.apiKey),
    body: JSON.stringify(buildChatBody(config, ru, context)),
  })

  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    throw new AiError(describeAiError(response.status, detail.slice(0, 160)), response.status)
  }

  const payload = (await response.json()) as unknown
  const draft = parseWordResult(extractChatContent(payload), ru)
  if (!draft.zh && !draft.example) throw new AiError('模型返回内容无法解析，请重试', 0)
  return draft
}
