/**
 * 真实调用验证（默认跳过）：需要提供 DeepSeek Key 才会执行。
 *
 *   DEEPSEEK_API_KEY=sk-xxx npx vitest run miniprogram/__tests__/ocr.live.spec.ts
 *
 * Key 只从环境变量读取，不落盘；样本图由 scripts/make-ocr-fixture.mjs 生成。
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { parseVisionLines, recognizeByVision } from '../core/ocr'
import type { AiConfig } from '../shared/ai'

const ROOT = fileURLToPath(new URL('../../', import.meta.url))
const FIXTURE = path.join(ROOT, 'tests', 'fixtures', 'ocr-wordlist.png')
const API_KEY = process.env.DEEPSEEK_API_KEY ?? ''

type WxLike = Record<string, unknown>
const wxRef = (): WxLike => (globalThis as unknown as { wx: WxLike }).wx

/** 期望识别出的词（样本图第 2 列） */
const EXPECTED = ['дом', 'книга', 'язык', 'учиться', 'здравствуйте', 'спасибо', 'хорошо', 'друг']

describe.skipIf(!API_KEY)('真实 DeepSeek 视觉识别', () => {
  it(
    '识别词表图片并返回可入库的单词',
    async () => {
      const base64 = readFileSync(FIXTURE).toString('base64')

      // 小程序里是 wx.getFileSystemManager().readFile，这里用真实文件内容替代
      wxRef().getFileSystemManager = () => ({
        readFile: (options: { filePath: string; success: (res: unknown) => void }) => {
          const target = options.filePath.endsWith('.png') ? base64 : ''
          options.success({ data: target })
        },
      })
      delete wxRef().compressImage

      wxRef().request = (options: {
        url: string
        method: string
        header: Record<string, string>
        data: unknown
        success: (res: { statusCode: number; data: unknown }) => void
        fail: (err: { errMsg: string }) => void
      }) => {
        void fetch(options.url, {
          method: options.method,
          headers: options.header,
          body: JSON.stringify(options.data),
        })
          .then(async (res) => options.success({ statusCode: res.status, data: await res.json() }))
          .catch((err: Error) => options.fail({ errMsg: err.message }))
      }

      const aiConfig: AiConfig = {
        provider: 'deepseek',
        apiKey: API_KEY,
        baseUrl: 'https://api.deepseek.com',
        model: 'deepseek-flash',
      }

      const lines = await recognizeByVision(aiConfig, 'wxfile://ocr-wordlist.png')

      // 打印原始结果，便于人工核对识别质量
      console.log('[live-ocr] 识别到', lines.length, '行：', lines.map((line) => line.text))

      const texts = lines.map((line) => line.text.toLowerCase())
      const hit = EXPECTED.filter((word) => texts.includes(word))
      console.log(`[live-ocr] 命中 ${hit.length}/${EXPECTED.length}：`, hit)
      const missed = EXPECTED.filter((word) => !texts.includes(word))
      if (missed.length) console.log('[live-ocr] 未命中：', missed)

      expect(lines.length).toBeGreaterThan(0)
      // 模型是「看图说话」不是专用 OCR，允许少量误差，但主体词汇应识别出来
      expect(hit.length).toBeGreaterThanOrEqual(Math.ceil(EXPECTED.length * 0.6))
      // 不应把中文释义混进单词
      expect(lines.every((line) => !/[\u4e00-\u9fa5]/.test(line.text))).toBe(true)
    },
    120_000,
  )

  it('解析层对真实输出的兜底：空响应不抛错', () => {
    expect(parseVisionLines('')).toEqual([])
  })
})
