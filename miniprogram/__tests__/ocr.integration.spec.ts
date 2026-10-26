/**
 * OCR 端到端验证：起一个本地 HTTP 服务模拟 OpenAI 兼容接口，
 * 用 fetch 充当 wx.request，验证真实网络链路上的路径拼接、鉴权头、
 * 请求体结构、大包传输与错误映射（不依赖真实 Key）。
 */
import { createServer, type Server } from 'node:http'
import { AddressInfo } from 'node:net'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { recognizeByVision, VISION_PROMPT } from '../core/ocr'
import type { AiConfig } from '../shared/ai'

interface CapturedRequest {
  method: string
  url: string
  authorization: string
  contentType: string
  body: {
    model?: string
    messages?: Array<{ role: string; content: unknown }>
  }
  bodyBytes: number
}

type WxLike = Record<string, unknown>
const wxRef = (): WxLike => (globalThis as unknown as { wx: WxLike }).wx

let server: Server
let baseUrl = ''
let captured: CapturedRequest[] = []
let nextReply: { status: number; content: string } = { status: 200, content: 'дом\nкнига' }

beforeAll(async () => {
  server = createServer((req, res) => {
    const chunks: Buffer[] = []
    req.on('data', (chunk: Buffer) => chunks.push(chunk))
    req.on('end', () => {
      const raw = Buffer.concat(chunks)
      let parsed: CapturedRequest['body'] = {}
      try {
        parsed = JSON.parse(raw.toString('utf8'))
      } catch {
        /* 保留空对象，测试里会因此失败 */
      }
      captured.push({
        method: req.method ?? '',
        url: req.url ?? '',
        authorization: String(req.headers.authorization ?? ''),
        contentType: String(req.headers['content-type'] ?? ''),
        body: parsed,
        bodyBytes: raw.byteLength,
      })
      res.writeHead(nextReply.status, { 'Content-Type': 'application/json' })
      res.end(
        JSON.stringify({
          choices: [{ message: { content: nextReply.content } }],
        }),
      )
    })
  })

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const { port } = server.address() as AddressInfo
  baseUrl = `http://127.0.0.1:${port}`
})

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()))
})

beforeEach(() => {
  captured = []
  nextReply = { status: 200, content: 'дом\nкнига' }
  delete wxRef().compressImage

  wxRef().getFileSystemManager = () => ({
    readFile: (options: { filePath: string; success: (res: unknown) => void }) => {
      // 用路径长度模拟不同体积的图片，验证大包能完整穿过链路
      options.success({ data: 'A'.repeat(1024) })
    },
  })

  wxRef().request = (options: {
    url: string
    method: string
    header: Record<string, string>
    data: unknown
    success: (res: unknown) => void
    fail: (err: { errMsg: string }) => void
  }) => {
    void fetch(options.url, {
      method: options.method,
      headers: options.header,
      body: JSON.stringify(options.data),
    })
      .then(async (res) => {
        options.success({ statusCode: res.status, data: await res.json() })
      })
      .catch((err: Error) => options.fail({ errMsg: err.message }))
  }
})

const config = (overrides: Partial<AiConfig> = {}): AiConfig => ({
  provider: 'deepseek',
  apiKey: 'sk-test',
  baseUrl,
  model: 'deepseek-flash',
  ...overrides,
})

describe('拍照识别端到端（真实 HTTP）', () => {
  it('请求打到 /v1/chat/completions，带 Bearer 鉴权和图片 block', async () => {
    const lines = await recognizeByVision(config(), 'wxfile://tmp_word_list.png')

    expect(captured).toHaveLength(1)
    const req = captured[0]
    expect(req.method).toBe('POST')
    expect(req.url).toBe('/v1/chat/completions')
    expect(req.authorization).toBe('Bearer sk-test')
    expect(req.contentType).toBe('application/json')
    expect(req.body.model).toBe('deepseek-v4-flash-vision-exp')

    const user = req.body.messages?.find((message) => message.role === 'user')
    const blocks = user?.content as Array<{ type: string; image_url?: { url: string } }>
    expect(blocks[1].type).toBe('image_url')
    expect(blocks[1].image_url?.url.startsWith('data:image/png;base64,')).toBe(true)

    const system = req.body.messages?.find((message) => message.role === 'system')
    expect(system?.content).toBe(VISION_PROMPT)

    expect(lines.map((line) => line.text)).toEqual(['дом', 'книга'])
    expect(lines[0].confidence).toBe(90)
  })

  it('大体积 base64 完整到达服务端', async () => {
    const big = 'B'.repeat(400_000)
    wxRef().getFileSystemManager = () => ({
      readFile: (options: { success: (res: unknown) => void }) => options.success({ data: big }),
    })

    await recognizeByVision(config(), 'wxfile://tmp.jpg')

    expect(captured[0].bodyBytes).toBeGreaterThan(400_000)
    const user = captured[0].body.messages?.find((message) => message.role === 'user')
    const blocks = user?.content as Array<{ image_url?: { url: string } }>
    expect(blocks[1].image_url?.url).toContain(big.slice(0, 32))
  })

  it('429 被翻译成限流提示', async () => {
    nextReply = { status: 429, content: 'rate limited' }
    await expect(recognizeByVision(config(), 'wxfile://tmp.jpg')).rejects.toThrow('请求过于频繁或被限流')
  })

  it('模型名不支持图片（400）时给出可读错误', async () => {
    nextReply = { status: 400, content: 'This model does not support image' }
    await expect(recognizeByVision(config(), 'wxfile://tmp.jpg')).rejects.toThrow('This model does not support image')
  })

  it('服务返回空内容时得到空结果而不是崩溃', async () => {
    nextReply = { status: 200, content: '' }
    await expect(recognizeByVision(config(), 'wxfile://tmp.jpg')).resolves.toEqual([])
  })
})
