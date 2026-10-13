/**
 * 把 shared/ 下与平台无关的 TS 同步到小程序目录。
 * shared/ 是唯一事实来源；小程序端直接使用副本，
 * 这样微信开发者工具只需编译 miniprogram/ 目录，同时两端逻辑不会漂移。
 * CI 通过 `sync:shared` + git diff 校验一致性。
 */
import { copyFile, mkdir, readdir, stat } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const FROM = path.join(ROOT, 'shared')
const TO = path.join(ROOT, 'miniprogram', 'shared')

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true })
  const files = []
  for (const entry of entries) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) files.push(...(await walk(full)))
    else if (entry.name.endsWith('.ts')) files.push(full)
  }
  return files
}

async function exists(file) {
  try {
    await stat(file)
    return true
  } catch {
    return false
  }
}

const files = (await exists(FROM)) ? await walk(FROM) : []
let count = 0
for (const file of files) {
  const relative = path.relative(FROM, file)
  const target = path.join(TO, relative)
  await mkdir(path.dirname(target), { recursive: true })
  await copyFile(file, target)
  count += 1
}
console.log(`[sync-shared] 已同步 ${count} 个文件到 miniprogram/shared`)
