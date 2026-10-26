/**
 * 小程序端 OCR，两条路径：
 * 1. 服务端接口（配置了 ocrEndpoint 时）：拍照 → wx.uploadFile → 返回识别行，准确率最好；
 * 2. DeepSeek 视觉模型（配置了 API Key 时）：拍照 → base64 → chat/completions，零服务端成本，
 *    但模型会把图片缩到约 800×800 等效，细密小字识别质量有限，结果必须人工校对。
 *
 * Tesseract.js 在小程序内不可用（无 WASM/Worker、包体受限），故不采用。
 */
import { config } from '../config'
import { chatCompletionsUrl, describeAiError, extractChatContent, type AiConfig } from '../shared/ai'

export interface OcrLine {
  text: string
  confidence: number
}

export const OCR_NOT_CONFIGURED = 'OCR_NOT_CONFIGURED'

/** 识别来源：服务端接口 / 视觉模型 / 未配置 */
export type OcrMode = 'server' | 'vision' | 'none'

export function resolveOcrMode(ocrEndpoint: string, hasApiKey: boolean): OcrMode {
  if (ocrEndpoint.trim()) return 'server'
  if (hasApiKey) return 'vision'
  return 'none'
}

// ---------- 图片处理 ----------

const MIME_BY_EXT: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
}

/** 从临时文件路径推断 MIME；未知后缀按 jpeg 处理（wx.chooseMedia 压缩图通常为 jpg） */
export function mimeFromPath(filePath: string): string {
  const match = /\.([a-zA-Z0-9]+)(?:\?|#|$)/.exec(filePath ?? '')
  const ext = match ? match[1].toLowerCase() : ''
  return MIME_BY_EXT[ext] ?? 'image/jpeg'
}

export function toDataUrl(base64: string, mime = 'image/jpeg'): string {
  return `data:${mime};base64,${base64}`
}

/** 压缩到 1600px 宽，避免 base64 后请求体过大（compressImage 需基础库 2.26.0+） */
async function shrinkImage(filePath: string): Promise<string> {
  if (typeof wx.compressImage !== 'function') return filePath
  try {
    const res = await new Promise<WechatMiniprogram.CompressImageSuccessCallbackResult>((resolve, reject) => {
      wx.compressImage({
        src: filePath,
        quality: 80,
        compressedWidth: 1600,
        success: resolve,
        fail: reject,
      })
    })
    return res.tempFilePath || filePath
  } catch {
    return filePath
  }
}

async function readAsBase64(filePath: string): Promise<string> {
  const fs = wx.getFileSystemManager()
  const res = await new Promise<WechatMiniprogram.ReadFileSuccessCallbackResult>((resolve, reject) => {
    fs.readFile({
      filePath,
      encoding: 'base64',
      success: resolve,
      fail: () => reject(new Error('读取图片失败，请重试')),
    })
  })
  return typeof res.data === 'string' ? res.data : ''
}

export async function pickImage(): Promise<string> {
  const media = await wx.chooseMedia({
    count: 1,
    mediaType: ['image'],
    sourceType: ['camera', 'album'],
    sizeType: ['compressed'],
  })
  const file = media.tempFiles?.[0]
  if (!file?.tempFilePath) throw new Error('未获取到图片')
  return file.tempFilePath
}

// ---------- 视觉模型路径 ----------

export const VISION_PROMPT = `你是俄语词表的 OCR 工具。请逐行读出图片中的俄语内容，严格遵守：
- 每行只输出一个俄语单词或短语，只保留西里尔字母、连字符和空格（可保留重音符号）；
- 忽略中文释义、页码、编号、标点、音标、表头；
- 不要输出解释、序号、引号、Markdown 代码块；
- 完全看不清的行直接跳过；某行吃不准时在该行末尾加一个半角问号 ?。`

export interface VisionBody {
  model: string
  messages: Array<{ role: 'system' | 'user'; content: unknown }>
  temperature: number
}

export function buildVisionBody(dataUrl: string, model: string): VisionBody {
  return {
    model,
    messages: [
      { role: 'system', content: VISION_PROMPT },
      {
        role: 'user',
        content: [
          { type: 'text', text: '识别这张图片里的俄语词表。' },
          { type: 'image_url', image_url: { url: dataUrl, detail: 'original' } },
        ],
      },
    ],
    temperature: 0,
  }
}

/**
 * 把模型输出收敛成识别行：去掉代码块/序号/项目符号，
 * 只保留含西里尔字母的行，末尾问号标记为低置信，重复行去重。
 */
export function parseVisionLines(raw: string): OcrLine[] {
  const text = (raw ?? '').replace(/```[a-zA-Z]*/g, '').trim()
  if (!text) return []

  const seen = new Set<string>()
  const lines: OcrLine[] = []

  for (const rawLine of text.split(/\r?\n/)) {
    let line = rawLine.trim()
    if (!line) continue
    // 去掉 “1.” “1、” “- ” “• ” 等前缀
    line = line.replace(/^(?:\d+[.、)]|[-*•·])\s*/, '').trim()

    let low = false
    if (/[?？]\s*$/.test(line)) {
      low = true
      line = line.replace(/[?？]\s*$/, '').trim()
    }

    // 只从第一个西里尔字母开始取，前面若是编号/符号则丢弃
    const cyrillicStart = line.search(/[А-Яа-яЁё]/)
    if (cyrillicStart < 0) continue
    line = line.slice(cyrillicStart).replace(/\s{2,}/g, ' ').trim()

    // 行内出现拉丁字母或中文则视为释义/注释，截断
    const latinBreak = line.search(/[A-Za-z\u4e00-\u9fa5]/)
    if (latinBreak > 0) line = line.slice(0, latinBreak).replace(/[\s,，.。:：;；\-—]+$/, '').trim()
    if (!line) continue

    const key = line.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    lines.push({ text: line, confidence: low ? 55 : 90 })
  }

  return lines
}

export async function recognizeByVision(aiConfig: AiConfig, filePath: string): Promise<OcrLine[]> {
  if (!aiConfig.apiKey.trim()) {
    const error = new Error('未配置 AI 密钥')
    ;(error as Error & { code?: string }).code = OCR_NOT_CONFIGURED
    throw error
  }
  const url = chatCompletionsUrl(aiConfig.baseUrl)
  if (!url) throw new Error('请先配置接口地址')

  const prepared = await shrinkImage(filePath)
  const base64 = await readAsBase64(prepared)
  if (!base64) throw new Error('读取图片失败，请重试')

  const body = buildVisionBody(toDataUrl(base64, mimeFromPath(prepared)), config.visionModel)

  const res = await new Promise<WechatMiniprogram.RequestSuccessCallbackResult>((resolve, reject) => {
    wx.request({
      url,
      method: 'POST',
      header: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${aiConfig.apiKey}`,
      },
      data: body as unknown as WechatMiniprogram.IAnyObject,
      timeout: 60000,
      success: resolve,
      fail: (err: { errMsg?: string }) => reject(new Error(err.errMsg || '网络请求失败')),
    })
  })

  if (res.statusCode < 200 || res.statusCode >= 300) {
    const detail = typeof res.data === 'string' ? res.data : JSON.stringify(res.data ?? '')
    throw new Error(describeAiError(res.statusCode, detail.slice(0, 120)))
  }

  return parseVisionLines(extractChatContent(res.data))
}

// ---------- 服务端接口路径 ----------

export async function recognizeFile(filePath: string): Promise<OcrLine[]> {
  if (!config.ocrEndpoint) {
    const error = new Error('未配置 OCR 服务地址')
    ;(error as Error & { code?: string }).code = OCR_NOT_CONFIGURED
    throw error
  }

  // 用回调形式调用，避免重载推断返回 UploadTask（无法读取响应）
  const res = await new Promise<WechatMiniprogram.UploadFileSuccessCallbackResult>(
    (resolve, reject) => {
      wx.uploadFile({
        url: config.ocrEndpoint,
        filePath,
        name: 'file',
        formData: { lang: 'rus' },
        success: resolve,
        fail: (err) => reject(new Error(err.errMsg || '上传失败')),
      })
    },
  )

  if (res.statusCode >= 400) throw new Error(`OCR 服务返回 ${res.statusCode}`)

  const data = JSON.parse(res.data) as { lines?: OcrLine[]; text?: string }
  const lines = (data.lines ?? [])
    .map((line) => ({ text: (line.text ?? '').replace(/\s+/g, ' ').trim(), confidence: line.confidence ?? 0 }))
    .filter((line) => line.text.length > 0)

  if (lines.length) return lines
  if (data.text) {
    return data.text
      .split(/\r?\n/)
      .map((text) => text.trim())
      .filter(Boolean)
      .map((text) => ({ text, confidence: 100 }))
  }
  return []
}
