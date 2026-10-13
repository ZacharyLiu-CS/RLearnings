/**
 * OCR 客户端：负责创建/复用/回收 Worker，向主线程暴露 Promise 化接口。
 */
export interface OcrLine {
  text: string
  confidence: number
}

export interface OcrProgress {
  progress: number
  status: string
}

const IDLE_RELEASE_MS = 45_000

let worker: Worker | null = null
let idleTimer = 0
let jobId = 0

function ensureWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL('./ocr.worker.ts', import.meta.url), { type: 'module' })
  }
  window.clearTimeout(idleTimer)
  return worker
}

/** 空闲一段时间后回收 Worker，避免长时间占用内存 */
function scheduleRelease(): void {
  window.clearTimeout(idleTimer)
  idleTimer = window.setTimeout(() => {
    worker?.postMessage({ type: 'dispose' })
    worker = null
  }, IDLE_RELEASE_MS)
}

export function disposeOcr(): void {
  window.clearTimeout(idleTimer)
  worker?.terminate()
  worker = null
}

const STATUS_TEXT: Record<string, string> = {
  'loading tesseract core': '加载识别引擎',
  'initializing tesseract': '初始化引擎',
  'loading language traineddata': '加载俄语模型（首次约 10MB，之后缓存）',
  'initializing api': '准备识别',
  'recognizing text': '识别中',
}

export function recognizeImage(
  bitmap: ImageBitmap,
  onProgress?: (progress: OcrProgress) => void,
): Promise<OcrLine[]> {
  const active = ensureWorker()
  const id = (jobId += 1)

  return new Promise<OcrLine[]>((resolve, reject) => {
    const cleanup = () => {
      active.removeEventListener('message', onMessage)
      active.removeEventListener('error', onError)
      scheduleRelease()
    }

    function onMessage(event: MessageEvent) {
      const data = event.data as
        | { type: 'progress'; jobId: number; progress: number; status: string }
        | { type: 'done'; jobId: number; lines: OcrLine[] }
        | { type: 'error'; jobId: number; message: string }

      if (data.jobId !== id) return
      if (data.type === 'progress') {
        onProgress?.({
          progress: data.progress,
          status: STATUS_TEXT[data.status] ?? data.status,
        })
        return
      }
      cleanup()
      if (data.type === 'done') resolve(data.lines)
      else reject(new Error(data.message))
    }

    function onError(event: ErrorEvent) {
      cleanup()
      reject(new Error(event.message || 'OCR 工作线程异常'))
    }

    active.addEventListener('message', onMessage)
    active.addEventListener('error', onError)
    active.postMessage({ type: 'recognize', jobId: id, bitmap }, [bitmap])
  })
}
