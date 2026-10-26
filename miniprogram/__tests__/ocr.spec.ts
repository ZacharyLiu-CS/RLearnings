import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  buildVisionBody,
  mimeFromPath,
  OCR_NOT_CONFIGURED,
  parseVisionLines,
  recognizeByVision,
  resolveOcrMode,
  toDataUrl,
} from '../core/ocr'
import type { AiConfig } from '../shared/ai'

const AI_CONFIG: AiConfig = {
  provider: 'deepseek',
  apiKey: 'sk-test',
  baseUrl: 'https://api.deepseek.com',
  model: 'deepseek-flash',
}

type WxLike = Record<string, unknown>

const wxRef = (): WxLike => (globalThis as unknown as { wx: WxLike }).wx

function stubRequest(impl: (options: WxLike) => void): ReturnType<typeof vi.fn> {
  const fn = vi.fn(impl)
  wxRef().request = fn
  return fn
}

function stubReadFile(data = 'BASE64DATA', shouldFail = false): ReturnType<typeof vi.fn> {
  const fn = vi.fn((options: WxLike) => {
    if (shouldFail) (options.fail as (err: unknown) => void)({ errMsg: 'readFile:fail' })
    else (options.success as (res: unknown) => void)({ data, errMsg: 'readFile:ok' })
  })
  wxRef().getFileSystemManager = () => ({ readFile: fn })
  return fn
}

function chatResponse(content: string, statusCode = 200): void {
  stubRequest((options) => {
    ;(options.success as (res: unknown) => void)({
      statusCode,
      data: { choices: [{ message: { content } }] },
    })
  })
}

describe('OCR 模式选择', () => {
  it('服务端接口优先，其次视觉模型，都没有则不展示入口', () => {
    expect(resolveOcrMode('https://bff/api/ocr', true)).toBe('server')
    expect(resolveOcrMode('https://bff/api/ocr', false)).toBe('server')
    expect(resolveOcrMode('', true)).toBe('vision')
    expect(resolveOcrMode('   ', false)).toBe('none')
  })
})

describe('图片编码', () => {
  it('按后缀推断 MIME，未知后缀回退 jpeg', () => {
    expect(mimeFromPath('wxfile://tmp_a.jpg')).toBe('image/jpeg')
    expect(mimeFromPath('/tmp/a.JPEG')).toBe('image/jpeg')
    expect(mimeFromPath('http://x/a.png?x=1')).toBe('image/png')
    expect(mimeFromPath('wxfile://tmp_a.webp')).toBe('image/webp')
    expect(mimeFromPath('wxfile://tmp_a.heic')).toBe('image/jpeg')
    expect(mimeFromPath('')).toBe('image/jpeg')
  })

  it('拼接 data URL', () => {
    expect(toDataUrl('AAA')).toBe('data:image/jpeg;base64,AAA')
    expect(toDataUrl('BBB', 'image/png')).toBe('data:image/png;base64,BBB')
  })
})

describe('视觉模型请求体', () => {
  it('图片走 image_url block，模型名可配置', () => {
    const body = buildVisionBody('data:image/jpeg;base64,AAA', 'deepseek-v4-flash-vision-exp')
    expect(body.model).toBe('deepseek-v4-flash-vision-exp')
    expect(body.temperature).toBe(0)

    const user = body.messages[1]
    expect(user.role).toBe('user')
    const blocks = user.content as Array<Record<string, unknown>>
    expect(blocks[0].type).toBe('text')
    expect(blocks[1]).toMatchObject({
      type: 'image_url',
      image_url: { url: 'data:image/jpeg;base64,AAA' },
    })
  })
})

describe('模型输出收敛', () => {
  it('去掉代码块、序号、项目符号', () => {
    const raw = ['```text', '1. дом', '2、книга', '- язык', '• стол', '```'].join('\n')
    expect(parseVisionLines(raw).map((line) => line.text)).toEqual(['дом', 'книга', 'язык', 'стол'])
  })

  it('截断行内中文释义与拉丁注释', () => {
    const raw = ['дом 房子', 'книга — book', 'язык, 语言'].join('\n')
    expect(parseVisionLines(raw).map((line) => line.text)).toEqual(['дом', 'книга', 'язык'])
  })

  it('无西里尔字母的行直接丢弃', () => {
    const raw = ['Vocabulary list', '12345', '——', 'дом'].join('\n')
    expect(parseVisionLines(raw).map((line) => line.text)).toEqual(['дом'])
  })

  it('末尾问号标记为低置信，并去掉问号', () => {
    const lines = parseVisionLines(['дом', 'слóво?'].join('\n'))
    expect(lines).toEqual([
      { text: 'дом', confidence: 90 },
      { text: 'слóво', confidence: 55 },
    ])
  })

  it('大小写不同的重复行只保留第一次', () => {
    expect(parseVisionLines(['дом', 'Дом', 'дом'].join('\n')).map((line) => line.text)).toEqual(['дом'])
  })

  it('空输出返回空数组', () => {
    expect(parseVisionLines('')).toEqual([])
    expect(parseVisionLines('   \n\n')).toEqual([])
  })
})

describe('recognizeByVision', () => {
  beforeEach(() => {
    delete wxRef().compressImage
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('读取图片 → 请求视觉模型 → 返回识别行', async () => {
    const readFile = stubReadFile('QUJD')
    const request = stubRequest((options) => {
      ;(options.success as (res: unknown) => void)({
        statusCode: 200,
        data: { choices: [{ message: { content: 'дом\nкнига' } }] },
      })
    })

    const lines = await recognizeByVision(AI_CONFIG, 'wxfile://tmp_a.png')

    expect(readFile).toHaveBeenCalledTimes(1)
    const payload = request.mock.calls[0][0] as unknown as { url: string; data: { model: string } }
    expect(payload.url).toBe('https://api.deepseek.com/v1/chat/completions')
    expect(payload.data.model).toBe('deepseek-v4-flash-vision-exp')
    expect(lines.map((line) => line.text)).toEqual(['дом', 'книга'])
  })

  it('优先使用压缩后的图片路径', async () => {
    wxRef().compressImage = vi.fn((options: WxLike) => {
      ;(options.success as (res: unknown) => void)({ tempFilePath: 'wxfile://compressed.jpg' })
    })
    const readFile = stubReadFile('QUJD')
    chatResponse('дом')

    await recognizeByVision(AI_CONFIG, 'wxfile://raw.png')

    expect(readFile.mock.calls[0][0]).toMatchObject({ filePath: 'wxfile://compressed.jpg' })
  })

  it('压缩失败时回退原图', async () => {
    wxRef().compressImage = vi.fn((options: WxLike) => {
      ;(options.fail as (err: unknown) => void)({ errMsg: 'compress fail' })
    })
    const readFile = stubReadFile('QUJD')
    chatResponse('дом')

    await recognizeByVision(AI_CONFIG, 'wxfile://raw.png')

    expect(readFile.mock.calls[0][0]).toMatchObject({ filePath: 'wxfile://raw.png' })
  })

  it('未配置 Key 时抛出可识别错误', async () => {
    await expect(recognizeByVision({ ...AI_CONFIG, apiKey: '' }, 'wxfile://a.jpg')).rejects.toMatchObject({
      code: OCR_NOT_CONFIGURED,
    })
  })

  it('HTTP 错误翻译成用户提示', async () => {
    stubReadFile('QUJD')
    stubRequest((options) => {
      ;(options.success as (res: unknown) => void)({ statusCode: 401, data: 'unauthorized' })
    })

    await expect(recognizeByVision(AI_CONFIG, 'wxfile://a.jpg')).rejects.toThrow('API Key 无效或已失效')
  })
})
