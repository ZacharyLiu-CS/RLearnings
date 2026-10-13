/**
 * AI 补全层（跨平台共享）：OpenAI 兼容协议，目前仅接入 DeepSeek。
 * 用户只需要给出俄语单词，释义 / 词性 / 重音 / 变位 / 例句 / 标签全部由模型生成。
 */

export type AiProvider = 'deepseek'

export interface AiConfig {
  provider: AiProvider
  apiKey: string
  baseUrl: string
  model: string
}

export interface ModelPreset {
  id: string
  label: string
}

export const AI_PROVIDERS: Array<{ id: AiProvider; label: string; baseUrl: string }> = [
  { id: 'deepseek', label: 'DeepSeek', baseUrl: 'https://api.deepseek.com' },
]

export const MODEL_PRESETS: ModelPreset[] = [
  { id: 'deepseek-flash', label: 'DeepSeek-V4.1-Flash（快，推荐）' },
  { id: 'deepseek-v4-pro', label: 'DeepSeek-V4-Pro（更强）' },
  { id: 'deepseek-chat', label: 'deepseek-chat（旧版兼容）' },
]

export const DEFAULT_AI_CONFIG: AiConfig = {
  provider: 'deepseek',
  apiKey: '',
  baseUrl: 'https://api.deepseek.com',
  model: 'deepseek-flash',
}

/** 补全结果（与 LearningItem 字段对应） */
export interface WordDraft {
  ru: string
  zh?: string
  pos?: string
  stress?: string
  forms?: string
  example?: string
  note?: string
  tags: string[]
}

export function normalizeBaseUrl(baseUrl: string): string {
  return (baseUrl || '').trim().replace(/\/+$/, '')
}

export function chatCompletionsUrl(baseUrl: string): string {
  const base = normalizeBaseUrl(baseUrl)
  if (!base) return ''
  if (base.endsWith('/chat/completions')) return base
  if (base.endsWith('/v1')) return `${base}/chat/completions`
  return `${base}/v1/chat/completions`
}

const SYSTEM_PROMPT = `你是俄语学习卡生成器。用户只给一个俄语单词或短语，你补全学习卡片所需字段。
只输出一个 JSON 对象，不要解释，不要 Markdown 代码块。
字段固定为：{"ru":string,"zh":string,"pos":string,"stress":string,"forms":string,"example":string,"example_zh":string,"tags":string[],"note":string}
要求：
- zh：简洁中文释义，多个义项用「；」分隔；
- pos：只能是 noun / verb / adj / adv / prep / pron / num / conj / part / phrase 之一；
- stress：带重音符号的写法（如 до́м），不确定则填空字符串；
- forms：主要变格 / 变位形式，逗号分隔，不确定则填空字符串；
- example：一条常用俄语例句（不超过 15 个词）；example_zh：该例句的中文翻译；
- tags：2-4 个学习标签（中文或俄语）；
- note：一条简短的记忆提示或常用搭配，没有就填空字符串。`

export function buildWordMessages(ru: string, context?: string): Array<{ role: 'system' | 'user'; content: string }> {
  const user = context ? `单词：${ru}\n语境：${context}` : `单词：${ru}`
  return [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: user },
  ]
}

/** 组装 OpenAI 兼容请求体，Web（fetch）与小程序（wx.request）共用 */
export function buildChatBody(config: AiConfig, ru: string, context?: string): {
  model: string
  messages: Array<{ role: 'system' | 'user'; content: string }>
  temperature: number
  response_format: { type: 'json_object' }
} {
  return {
    model: config.model || DEFAULT_AI_CONFIG.model,
    messages: buildWordMessages(ru, context),
    temperature: 0.2,
    response_format: { type: 'json_object' },
  }
}

export function buildChatHeaders(apiKey: string): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${apiKey}`,
  }
}

const POS_ALIASES: Array<[RegExp, string]> = [
  [/名词|существительное|^n$|noun/i, 'noun'],
  [/动词|глагол|verb/i, 'verb'],
  [/形容词|прилагательное|adj/i, 'adj'],
  [/副词|наречие|adv/i, 'adv'],
  [/前置词|предлог|prep/i, 'prep'],
  [/代词|местоимение|pron/i, 'pron'],
  [/数词|числительное|num/i, 'num'],
  [/连词|союз|conj/i, 'conj'],
  [/语气词|частица|part/i, 'part'],
  [/短语|词组|phrase/i, 'phrase'],
]

function normalizePos(value: unknown): string | undefined {
  if (typeof value !== 'string' || !value.trim()) return undefined
  for (const [pattern, pos] of POS_ALIASES) {
    if (pattern.test(value)) return pos
  }
  return undefined
}

function pickString(source: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = source[key]
    if (typeof value === 'string' && value.trim()) return value.trim()
    if (Array.isArray(value) && value.length && typeof value[0] === 'string') return value.join('；')
  }
  return undefined
}

function pickTags(source: Record<string, unknown>): string[] {
  const raw = source.tags ?? source.themes ?? source.categories
  if (Array.isArray(raw)) {
    return raw
      .map((tag) => (typeof tag === 'string' ? tag.trim() : ''))
      .filter(Boolean)
      .slice(0, 6)
  }
  if (typeof raw === 'string' && raw.trim()) {
    return raw
      .split(/[,，;；|]/)
      .map((tag) => tag.trim())
      .filter(Boolean)
      .slice(0, 6)
  }
  return []
}

/** 从模型输出中提取 JSON 文本（兼容 ```json 代码块与前后废话） */
export function extractJsonText(raw: string): string {
  const text = (raw ?? '').trim()
  if (!text) return ''
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const candidate = fenced ? fenced[1] : text
  const start = candidate.indexOf('{')
  const end = candidate.lastIndexOf('}')
  if (start >= 0 && end > start) return candidate.slice(start, end + 1)
  return candidate
}

/**
 * 宽容解析：模型可能返回别名键或嵌套结构，这里统一收敛到 WordDraft。
 * 解析失败时至少保留 ru，保证录入流程不中断。
 */
export function parseWordResult(raw: string, fallbackRu: string): WordDraft {
  const empty: WordDraft = { ru: fallbackRu, tags: [] }
  const jsonText = extractJsonText(raw)
  if (!jsonText) return empty

  let data: Record<string, unknown>
  try {
    data = JSON.parse(jsonText) as Record<string, unknown>
  } catch {
    return empty
  }

  const meanings = Array.isArray(data.meanings) ? (data.meanings as Array<Record<string, unknown>>) : []
  const firstMeaning = meanings[0]

  const zh =
    pickString(data, ['zh', 'translation', 'meaning', 'translation_zh']) ??
    (firstMeaning ? pickString(firstMeaning, ['sense', 'meaning', 'zh']) : undefined)

  const exampleRu =
    pickString(data, ['example', 'example_ru', 'sentence']) ??
    (firstMeaning ? pickString(firstMeaning, ['example', 'example_ru']) : undefined)
  const exampleZh =
    pickString(data, ['example_zh']) ??
    (firstMeaning ? pickString(firstMeaning, ['example_zh', 'translation']) : undefined)

  const formsRaw = data.forms ?? data.declension ?? data.conjugation
  let forms = pickString(data, ['forms'])
  if (!forms && formsRaw && typeof formsRaw === 'object') {
    forms = JSON.stringify(formsRaw).slice(0, 300)
  }

  const noteBase = pickString(data, ['note', 'mnemonic', 'tip'])
  const note = exampleZh
    ? noteBase
      ? `${noteBase}｜例句：${exampleZh}`
      : `例句：${exampleZh}`
    : noteBase

  return {
    ru: pickString(data, ['ru', 'word', 'lemma']) ?? fallbackRu,
    zh,
    pos: normalizePos(data.pos ?? data.part_of_speech),
    stress: pickString(data, ['stress', 'accent']),
    forms,
    example: exampleRu,
    note,
    tags: pickTags(data),
  }
}

/** 从 OpenAI 兼容响应中取出文本内容 */
export function extractChatContent(payload: unknown): string {
  const data = payload as { choices?: Array<{ message?: { content?: string } }> }
  return data?.choices?.[0]?.message?.content ?? ''
}

/** 错误码映射：把 HTTP 状态翻译成用户能懂的提示 */
export function describeAiError(status: number, message?: string): string {
  if (status === 401) return 'API Key 无效或已失效，请检查设置'
  if (status === 402) return '账户余额不足，请充值后再试'
  if (status === 404) return '模型不存在，请更换模型名称'
  if (status === 422) return '请求被拒绝，请检查模型或参数'
  if (status === 429) return '请求过于频繁或被限流，请稍后再试'
  if (status >= 500) return '模型服务暂时不可用，请稍后再试'
  return message || 'AI 请求失败'
}
