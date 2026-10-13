/**
 * 将 tesseract 的 wasm core 复制到 public 目录，使 OCR 可离线运行（不依赖 CDN）。
 * 仅在本地资源缺失时告警，不阻断安装。
 */
import { copyFile, mkdir, stat } from 'node:fs/promises'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const OUT_DIR = fileURLToPath(new URL('../public/tesseract-core/', import.meta.url))

const FILES = [
  'tesseract-core-simd-lstm.wasm.js',
  'tesseract-core-simd-lstm.wasm',
  'tesseract-core-lstm.wasm.js',
  'tesseract-core-lstm.wasm',
]

async function exists(file) {
  try {
    await stat(file)
    return true
  } catch {
    return false
  }
}

try {
  const coreDir = path.dirname(require.resolve('tesseract.js-core/package.json'))
  await mkdir(OUT_DIR, { recursive: true })
  for (const file of FILES) {
    const from = path.join(coreDir, file)
    if (!(await exists(from))) {
      console.warn(`[sync-tesseract] 缺少 ${file}，OCR 将回退到 CDN`)
      continue
    }
    await copyFile(from, path.join(OUT_DIR, file))
  }
  console.log('[sync-tesseract] wasm core 已同步到 public/tesseract-core')
} catch (err) {
  console.warn('[sync-tesseract] 同步失败，OCR 将回退到 CDN：', err instanceof Error ? err.message : err)
}
