/// <reference lib="webworker" />
/**
 * OCR 工作线程：图像预处理 + Tesseract 识别全部在 Worker 内完成，主线程零阻塞。
 * 语言包（rus）首次懒加载，由浏览器缓存，二次秒开。
 */
import { createWorker, type Worker as TesseractWorker } from 'tesseract.js'
// 以源码内联 + Blob URL 方式加载 tesseract worker：dev 与 build 行为一致，
// 不依赖 CDN，也不受 Vite 对 node_modules 内 JS 资源的转换影响。
import tessWorkerSource from 'tesseract.js/dist/worker.min.js?raw'

const ORIGIN = (self as unknown as WorkerGlobalScope).location.origin
const CORE_PATH = `${ORIGIN}${import.meta.env.BASE_URL}tesseract-core`
const TESS_WORKER_URL = URL.createObjectURL(
  new Blob([tessWorkerSource], { type: 'text/javascript' }),
)

interface RecognizeMessage {
  type: 'recognize'
  jobId: number
  bitmap: ImageBitmap
}

type IncomingMessage = RecognizeMessage | { type: 'dispose' }

let tess: TesseractWorker | null = null
let loading: Promise<TesseractWorker> | null = null
let activeJobId = 0

function post(message: Record<string, unknown>): void {
  ;(self as unknown as Worker).postMessage(message)
}

/**
 * 优先使用随包发布的本地 wasm core（离线可用）；
 * 资源缺失时（例如部署时未同步 public/tesseract-core）自动回退 tesseract 默认 CDN。
 */
async function resolveCorePath(): Promise<string | undefined> {
  try {
    const response = await fetch(`${CORE_PATH}/tesseract-core-simd-lstm.wasm.js`, { method: 'HEAD' })
    return response.ok ? CORE_PATH : undefined
  } catch {
    return undefined
  }
}

async function getWorker(): Promise<TesseractWorker> {
  if (tess) return tess
  if (!loading) {
    loading = resolveCorePath().then((corePath) =>
      createWorker(
        'rus',
        1,
        {
          workerPath: TESS_WORKER_URL,
          corePath,
          logger: (m: { status?: string; progress?: number }) => {
            post({
              type: 'progress',
              jobId: activeJobId,
              status: m.status ?? 'recognizing text',
              progress: typeof m.progress === 'number' ? m.progress : 0,
            })
          },
        } as Parameters<typeof createWorker>[2],
      ),
    )
  }
  tess = await loading
  return tess
}

/** 放大 2 倍 + 灰度 + Otsu 二值化，显著提升印刷体识别率 */
async function preprocess(bitmap: ImageBitmap): Promise<Blob> {
  const scale = 2
  const width = Math.max(1, Math.round(bitmap.width * scale))
  const height = Math.max(1, Math.round(bitmap.height * scale))
  const canvas = new OffscreenCanvas(width, height)
  const ctx = canvas.getContext('2d')
  if (!ctx) return new Blob()

  ctx.drawImage(bitmap, 0, 0, width, height)
  const image = ctx.getImageData(0, 0, width, height)
  const data = image.data

  // 灰度直方图
  const histogram = new Uint32Array(256)
  for (let i = 0; i < data.length; i += 4) {
    const gray = (data[i] * 299 + data[i + 1] * 587 + data[i + 2] * 114) / 1000
    data[i] = data[i + 1] = data[i + 2] = gray
    histogram[Math.round(gray)] += 1
  }

  // Otsu：最大化类间方差求阈值
  const total = width * height
  let sum = 0
  for (let level = 0; level < 256; level += 1) sum += level * histogram[level]
  let sumB = 0
  let weightB = 0
  let threshold = 127
  let maxVariance = 0
  for (let level = 0; level < 256; level += 1) {
    weightB += histogram[level]
    if (!weightB) continue
    const weightF = total - weightB
    if (!weightF) break
    sumB += level * histogram[level]
    const meanB = sumB / weightB
    const meanF = (sum - sumB) / weightF
    const variance = weightB * weightF * (meanB - meanF) * (meanB - meanF)
    if (variance > maxVariance) {
      maxVariance = variance
      threshold = level
    }
  }

  for (let i = 0; i < data.length; i += 4) {
    const value = data[i] > threshold ? 255 : 0
    data[i] = data[i + 1] = data[i + 2] = value
  }
  ctx.putImageData(image, 0, 0)
  return canvas.convertToBlob({ type: 'image/png' })
}

self.onmessage = async (event: MessageEvent<IncomingMessage>) => {
  const message = event.data

  if (message.type === 'dispose') {
    await tess?.terminate()
    tess = null
    loading = null
    return
  }

  activeJobId = message.jobId
  try {
    const worker = await getWorker()
    const blob = await preprocess(message.bitmap)
    const { data } = await worker.recognize(blob)
    const lines = (data.lines ?? [])
      .map((line) => ({
        text: (line.text ?? '').replace(/\s+/g, ' ').trim(),
        confidence: line.confidence ?? 0,
      }))
      .filter((line) => line.text.length > 0)
    post({ type: 'done', jobId: message.jobId, lines, text: data.text ?? '' })
  } catch (err) {
    post({
      type: 'error',
      jobId: message.jobId,
      message: err instanceof Error ? err.message : String(err),
    })
  } finally {
    message.bitmap.close()
  }
}
