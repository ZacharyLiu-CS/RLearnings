/**
 * AI 客户端（小程序 / wx.request）：调用 OpenAI 兼容的 /chat/completions 补全词条。
 * 注意：真机需在小程序后台把 API 域名加入 request 合法域名；开发阶段可勾选「不校验合法域名」。
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
} from '../shared/ai'

export class AiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message)
    this.name = 'AiError'
  }
}

function request(
  url: string,
  method: 'POST',
  header: Record<string, string>,
  data: WechatMiniprogram.IAnyObject | string,
  timeout = 30000,
): Promise<WechatMiniprogram.RequestSuccessCallbackResult> {
  return new Promise((resolve, reject) => {
    wx.request({
      url,
      method,
      header,
      data,
      timeout,
      success: resolve,
      fail: (err: { errMsg?: string }) => reject(new AiError(err.errMsg || '网络请求失败', 0)),
    })
  })
}

function assertConfig(config: AiConfig): string {
  if (!config.apiKey.trim()) throw new AiError('请先配置 API Key', 0)
  const url = chatCompletionsUrl(config.baseUrl)
  if (!url) throw new AiError('请先配置接口地址', 0)
  return url
}

export async function testConnection(config: AiConfig): Promise<string> {
  const url = assertConfig(config)
  const res = await request(url, 'POST', buildChatHeaders(config.apiKey), {
    model: config.model,
    messages: [{ role: 'user', content: '回复 OK 两个字' }],
    max_tokens: 8,
  })
  if (res.statusCode < 200 || res.statusCode >= 300) {
    const detail = typeof res.data === 'string' ? res.data : JSON.stringify(res.data ?? '')
    throw new AiError(describeAiError(res.statusCode, detail.slice(0, 120)), res.statusCode)
  }
  return '连接正常'
}

/** 只给一个俄语单词，返回补全后的词条草稿 */
export async function enrichWord(config: AiConfig, ru: string, context?: string): Promise<WordDraft> {
  const url = assertConfig(config)
  const res = await request(url, 'POST', buildChatHeaders(config.apiKey), buildChatBody(config, ru, context))
  if (res.statusCode < 200 || res.statusCode >= 300) {
    const detail = typeof res.data === 'string' ? res.data : JSON.stringify(res.data ?? '')
    throw new AiError(describeAiError(res.statusCode, detail.slice(0, 160)), res.statusCode)
  }
  const draft = parseWordResult(extractChatContent(res.data), ru)
  if (!draft.zh && !draft.example) throw new AiError('模型返回内容无法解析，请重试', 0)
  return draft
}
