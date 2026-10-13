/**
 * 性能预算卡点：统计首屏（index.html 直接引用）资源的 gzip 体积，超出预算则失败。
 * 用法：node scripts/check-budget.mjs [预算KB，默认 200]
 */
import { readFile, stat } from 'node:fs/promises'
import path from 'node:path'
import { gzipSync } from 'node:zlib'

const BUDGET_KB = Number(process.argv[2] ?? process.env.BUDGET_KB ?? 200)
const DIST = path.resolve(process.cwd(), 'dist')

const html = await readFile(path.join(DIST, 'index.html'), 'utf8')
const refs = [...new Set([...html.matchAll(/(?:src|href)="([^"]+\.(?:js|css))"/g)].map((m) => m[1]))]

let total = 0
for (const ref of refs) {
  const file = path.join(DIST, ref.replace(/^\//, ''))
  try {
    await stat(file)
  } catch {
    console.warn(`[budget] 资源缺失：${ref}`)
    continue
  }
  const size = gzipSync(await readFile(file)).length
  total += size
  console.log(`  · ${ref} → ${(size / 1024).toFixed(1)} KB gzip`)
}

const totalKb = total / 1024
console.log(`\n首屏合计 ${totalKb.toFixed(1)} KB gzip / 预算 ${BUDGET_KB} KB`)

if (totalKb > BUDGET_KB) {
  console.error(`✗ 超出性能预算 ${(totalKb - BUDGET_KB).toFixed(1)} KB`)
  process.exit(1)
}
console.log('✓ 性能预算通过')
