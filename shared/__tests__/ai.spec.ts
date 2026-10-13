import { describe, expect, it } from 'vitest'
import {
  DEFAULT_AI_CONFIG,
  buildChatBody,
  buildChatHeaders,
  chatCompletionsUrl,
  describeAiError,
  extractChatContent,
  extractJsonText,
  parseWordResult,
} from '../ai'

describe('AI 补全层', () => {
  it('接口地址补全为 /v1/chat/completions，且不重复拼接', () => {
    expect(chatCompletionsUrl('https://api.deepseek.com')).toBe('https://api.deepseek.com/v1/chat/completions')
    expect(chatCompletionsUrl('https://api.deepseek.com/v1')).toBe('https://api.deepseek.com/v1/chat/completions')
    expect(chatCompletionsUrl('https://api.deepseek.com/v1/chat/completions')).toBe(
      'https://api.deepseek.com/v1/chat/completions',
    )
    expect(chatCompletionsUrl('')).toBe('')
  })

  it('请求体带 Bearer 头与 JSON 结构化输出约束', () => {
    const body = buildChatBody(DEFAULT_AI_CONFIG, 'дом')
    expect(body.model).toBe('deepseek-flash')
    expect(body.response_format).toEqual({ type: 'json_object' })
    expect(body.messages[1].content).toContain('дом')
    expect(buildChatHeaders('sk-test').Authorization).toBe('Bearer sk-test')
  })

  it('能从 Markdown 代码块与前后废话中提取 JSON', () => {
    expect(extractJsonText('好的：\n```json\n{"ru":"дом"}\n```\n结束')).toBe('{"ru":"дом"}')
    expect(extractJsonText('前缀 {"ru":"дом"} 后缀')).toBe('{"ru":"дом"}')
    expect(extractJsonText('')).toBe('')
  })

  it('宽容解析：兼容别名键、嵌套义项与词性归一化', () => {
    const raw = JSON.stringify({
      word: 'изучать',
      translation: '学习；研究',
      part_of_speech: '动词（глагол）',
      stress: 'изуча́ть',
      declension: { present: ['изуча́ю'] },
      meanings: [{ sense: '学习', example: 'Я изуча́ю ру́сский язы́к.', example_zh: '我在学习俄语。' }],
      tags: ['动词', '学习'],
    })
    const draft = parseWordResult(raw, 'изучать')
    expect(draft.ru).toBe('изучать')
    expect(draft.zh).toBe('学习；研究')
    expect(draft.pos).toBe('verb')
    expect(draft.stress).toBe('изуча́ть')
    expect(draft.example).toBe('Я изуча́ю ру́сский язы́к.')
    expect(draft.note).toContain('我在学习俄语')
    expect(draft.tags).toEqual(['动词', '学习'])
  })

  it('解析失败时至少保留原文，保证录入流程不中断', () => {
    expect(parseWordResult('不是 JSON', 'дом')).toEqual({ ru: 'дом', tags: [] })
    expect(parseWordResult('', 'дом').ru).toBe('дом')
  })

  it('响应内容提取与错误提示映射', () => {
    expect(extractChatContent({ choices: [{ message: { content: '{"ru":"дом"}' } }] })).toBe('{"ru":"дом"}')
    expect(extractChatContent({})).toBe('')
    expect(describeAiError(401)).toContain('API Key')
    expect(describeAiError(402)).toContain('余额')
    expect(describeAiError(429)).toContain('稍后')
  })
})
