/**
 * 生成 OCR 测试样本：把一张「俄语词表」渲染成图片，用于拍照识别回归验证。
 * 用法：node scripts/make-ocr-fixture.mjs
 * 产出：tests/fixtures/ocr-wordlist.png
 */
import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright-core'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const OUT_DIR = path.join(ROOT, 'tests', 'fixtures')
const OUT_FILE = path.join(OUT_DIR, 'ocr-wordlist.png')

const WORDS = [
  ['1', 'дом', '房子'],
  ['2', 'книга', '书'],
  ['3', 'язык', '语言'],
  ['4', 'учиться', '学习'],
  ['5', 'здравствуйте', '您好'],
  ['6', 'спасибо', '谢谢'],
  ['7', 'хорошо', '好'],
  ['8', 'друг', '朋友'],
]

const html = `<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8" />
<style>
  body {
    margin: 0;
    padding: 36px 40px;
    background: #fdfcf7;
    font-family: "Times New Roman", "Songti SC", serif;
    color: #1a1a1a;
  }
  h1 { font-size: 26px; margin: 0 0 6px; }
  .sub { font-size: 13px; color: #666; margin-bottom: 18px; letter-spacing: .5px; }
  table { border-collapse: collapse; width: 100%; }
  th, td { text-align: left; padding: 7px 8px; border-bottom: 1px solid #ddd; }
  th { font-size: 13px; color: #555; font-weight: normal; }
  td.ru { font-size: 27px; }
  td.zh { font-size: 17px; color: #333; }
  td.n { font-size: 14px; color: #888; width: 28px; }
</style>
</head>
<body>
  <h1>Урок 1 · Словарь</h1>
  <div class="sub">俄语第一课 · 基础词汇</div>
  <table>
    <tr><th></th><th>Слово</th><th>Перевод</th></tr>
    ${WORDS.map(([n, ru, zh]) => `<tr><td class="n">${n}</td><td class="ru">${ru}</td><td class="zh">${zh}</td></tr>`).join('')}
  </table>
</body>
</html>`

const browser = await chromium.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
})
const page = await browser.newPage({ viewport: { width: 760, height: 640 }, deviceScaleFactor: 2 })
await page.setContent(html, { waitUntil: 'load' })
await mkdir(OUT_DIR, { recursive: true })
await page.screenshot({ path: OUT_FILE })
await browser.close()

console.log(`[ocr-fixture] 已生成 ${OUT_FILE}`)
