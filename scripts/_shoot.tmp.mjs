import { chromium } from 'playwright-core'

const base = 'http://localhost:5199'
const out = '/tmp/rlshots'

const browser = await chromium.launch({ channel: 'chrome', headless: true })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })

const routes = [
  ['review', '/words/review'],
  ['library', '/words/library'],
  ['add', '/words/add'],
  ['stats', '/words/stats'],
  ['settings', '/words/settings'],
]

// 注入演示数据，让页面有真实内容可看
await page.goto(base + '/words/review', { waitUntil: 'networkidle' })
await page.evaluate(async () => {
  // 等待 app 挂载后通过 store seed demo 数据（通过全局事件或直接操作 IndexedDB 太重，直接跳过）
})
await page.waitForTimeout(800)
await page.screenshot({ path: `${out}/1-review.png` })

for (const [name, path] of routes.slice(1)) {
  await page.goto(base + path, { waitUntil: 'networkidle' })
  await page.waitForTimeout(700)
  await page.screenshot({ path: `${out}/${name}.png` })
}

await browser.close()
console.log('done')
