/**
 * 图标生成：用 Chrome 把矢量图形按目标尺寸直接光栅化（矢量 → 精确像素，不重采样，任何分辨率都清晰）。
 *
 * 产出：
 *  - assets/icons/*.svg                     应用图标矢量源（设计稿，可直接改）
 *  - assets/icons/app/<variant>-<size>.png  应用图标多尺寸位图（上传小程序头像/商店素材用）
 *  - miniprogram/images/tab/*.png           tabBar 图标（81×81 与 @2x 162×162，含选中态）
 *  - public/favicon.svg, public/apple-touch-icon.png  Web 端图标
 *
 * 用法：npm run icons
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright-core'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const ICON_PATHS = JSON.parse(readFileSync(path.join(ROOT, 'shared/ui-icons.json'), 'utf8'))

const INK = '#d4321f'
const PAPER = '#ffffff'
const TAB_IDLE = '#5c5c58'

/* ---------------- 应用图标：洋葱顶（луковичный купол） ---------------- */
/** 俄罗斯宗教建筑最典型的符号：洋葱顶 + 顶端十字 + 基座；负空间化用成「知识之塔」 */
function onionSvg(size) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 1024 1024">
  <rect width="1024" height="1024" fill="${INK}"/>
  <g transform="translate(0 40)" fill="${PAPER}">
    <path d="M512 296 C512 336 470 386 442 434 C380 490 300 512 300 566 C300 652 350 674 384 700 L640 700 C674 674 724 652 724 566 C724 512 644 490 582 434 C554 386 512 336 512 296 Z"/>
    <rect x="499" y="176" width="26" height="130"/>
    <rect x="462" y="216" width="100" height="26"/>
    <rect x="300" y="724" width="424" height="34"/>
  </g>
</svg>`
}

/* ---------------- 备选：火鸟 / Сирин 之羽 ---------------- */
/** 俄罗斯民间传说中的火鸟羽毛，也读作书写之笔（学习意象） */
function featherSvg(size) {
  const barbs = [
    [498, 330, 424, 398],
    [498, 430, 402, 508],
    [498, 530, 424, 612],
    [526, 330, 600, 398],
    [526, 430, 622, 508],
    [526, 530, 600, 612],
  ]
    .map(([x1, y1, x2, y2]) => `<path d="M${x1} ${y1} L${x2} ${y2}"/>`)
    .join('\n    ')

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 1024 1024">
  <rect width="1024" height="1024" fill="${INK}"/>
  <g transform="translate(0 -12)">
    <path fill="${PAPER}" d="M512 168 C648 288 668 512 528 792 L496 792 C356 512 376 288 512 168 Z"/>
    <rect x="502" y="700" width="20" height="180" rx="10" fill="${PAPER}"/>
    <g stroke="${INK}" stroke-width="13" stroke-linecap="round" fill="none">
    ${barbs}
    </g>
  </g>
</svg>`
}

/* ---------------- tabBar 图标 ---------------- */
function tabSvg(name, color, size) {
  const paths = (ICON_PATHS[name] ?? []).map((d) => `<path d="${d}"/>`).join('\n  ')
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24">
  <g fill="none" stroke="${color}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
  ${paths}
  </g>
</svg>`
}

const APP_VARIANTS = [
  { id: 'onion', svg: onionSvg },
  { id: 'feather', svg: featherSvg },
]
const APP_SIZES = [1024, 512, 256, 192, 180, 144, 120, 96, 64, 48]
const TABS = ['bolt', 'library', 'plus', 'chart']
const TAB_FILES = { bolt: 'review', library: 'library', plus: 'add', chart: 'stats' }

async function main() {
  const browser = await chromium.launch({ channel: 'chrome' })
  const page = await browser.newPage({ deviceScaleFactor: 1 })

  async function render(svg, size, file) {
    await page.setViewportSize({ width: size, height: size })
    await page.setContent(
      `<!doctype html><html><body style="margin:0;background:transparent">${svg}</body></html>`,
    )
    const buffer = await page.screenshot({
      omitBackground: true,
      clip: { x: 0, y: 0, width: size, height: size },
    })
    mkdirSync(path.dirname(file), { recursive: true })
    writeFileSync(file, buffer)
  }

  function writeText(file, content) {
    mkdirSync(path.dirname(file), { recursive: true })
    writeFileSync(file, content)
  }

  // 1. 应用图标：矢量源 + 多尺寸位图
  for (const variant of APP_VARIANTS) {
    writeText(path.join(ROOT, "assets/icons", `app-icon-${variant.id}.svg`), variant.svg(1024))
    for (const size of APP_SIZES) {
      await render(
        variant.svg(size),
        size,
        path.join(ROOT, 'assets/icons/app', `${variant.id}-${size}.png`),
      )
    }
  }

  // 2. tabBar 图标（小程序）
  for (const name of TABS) {
    const fileBase = TAB_FILES[name]
    const targets = [
      [`${fileBase}.png`, TAB_IDLE, 81],
      [`${fileBase}-active.png`, INK, 81],
      [`${fileBase}@2x.png`, TAB_IDLE, 162],
      [`${fileBase}-active@2x.png`, INK, 162],
    ]
    for (const [file, color, size] of targets) {
      await render(
        tabSvg(name, color, size),
        size,
        path.join(ROOT, 'miniprogram/images/tab', file),
      )
    }
  }

  // 3. Web 端
  writeText(path.join(ROOT, "public/favicon.svg"), onionSvg(64))
  await render(onionSvg(180), 180, path.join(ROOT, 'public/apple-touch-icon.png'))
  await render(onionSvg(512), 512, path.join(ROOT, 'assets/icons/app/onion-512.png'))

  await browser.close()
  console.log('[icons] 已生成：应用图标 %d 个尺寸 × %d 套、tabBar %d 组、Web favicon', APP_SIZES.length, APP_VARIANTS.length, TABS.length)
}

await main()
