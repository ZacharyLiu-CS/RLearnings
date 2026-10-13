/**
 * 小程序端 OCR：Tesseract.js（WASM + Worker）在小程序不可用，
 * 改为「拍照/选图 → 上传服务端 OCR 接口」。
 * 未配置接口时抛出可识别错误，页面层降级为手动 / 批量录入。
 */
import { config } from '../config'

export interface OcrLine {
  text: string
  confidence: number
}

export const OCR_NOT_CONFIGURED = 'OCR_NOT_CONFIGURED'

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
