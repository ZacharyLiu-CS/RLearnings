/**
 * 单词模块 store：列表 / 录入 / 复习 / 统计。
 * 所有写操作采用「本地即时更新 + 后台落库」的乐观更新，交互零等待。
 */
import { defineStore } from 'pinia'
import { computed, reactive, ref } from 'vue'
import { createItem, repository, type ItemQuery, type StatusCounts } from '@/core/db/repository'
import { srs } from '@/core/srs'
import { bus } from '@/core/event-bus'
import { usePlatformStore } from '@/core/stores/platform'
import type { ItemSourceModule, LearningItem, Rating, ReviewLog } from '@/core/types'
import { addDaysIso, dayKey, isoNow, lastDays } from '@/core/utils/date'
import { buildBackup, downloadFile, parseBackup, toCsv } from '@/core/db/backup'

export interface ItemDraft {
  ru: string
  zh?: string
  pos?: string
  stress?: string
  forms?: string
  example?: string
  note?: string
  tags?: string[]
}

const DEMO_WORDS: Array<[string, string, string]> = [
  ['дом', '房子', 'noun'],
  ['книга', '书', 'noun'],
  ['говорить', '说', 'verb'],
  ['учебник', '课本', 'noun'],
  ['красивый', '美丽的', 'adj'],
  ['быстро', '快速地', 'adv'],
  ['город', '城市', 'noun'],
  ['работа', '工作', 'noun'],
  ['друг', '朋友', 'noun'],
  ['время', '时间', 'noun'],
  ['понимать', '理解', 'verb'],
  ['изучать', '学习', 'verb'],
  ['утро', '早晨', 'noun'],
  ['вода', '水', 'noun'],
  ['солнце', '太阳', 'noun'],
  ['дорога', '道路', 'noun'],
  ['музыка', '音乐', 'noun'],
  ['школа', '学校', 'noun'],
  ['любить', '爱', 'verb'],
  ['думать', '想，思考', 'verb'],
  ['театр', '剧院', 'noun'],
  ['окно', '窗户', 'noun'],
  ['сердце', '心脏', 'noun'],
  ['письмо', '信', 'noun'],
  ['вопрос', '问题', 'noun'],
  ['ответ', '答案', 'noun'],
  ['история', '历史；故事', 'noun'],
  ['язык', '语言', 'noun'],
  ['слово', '单词', 'noun'],
  ['счастье', '幸福', 'noun'],
]

/**
 * 去掉 Vue 响应式代理：IndexedDB 的结构化克隆不能处理 Proxy（会抛 DataCloneError），
 * 因此所有写入仓储的对象都先做一次纯对象化。
 */
function plain<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function shuffle<T>(list: T[]): T[] {
  const out = [...list]
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

export const useWordsStore = defineStore('words', () => {
  const platform = usePlatformStore()

  const items = ref<LearningItem[]>([])
  const total = ref(0)
  const loading = ref(false)
  const query = reactive<ItemQuery>({
    keyword: '',
    type: 'all',
    status: 'all',
    source: 'all',
    starredOnly: false,
  })

  const stats = ref<StatusCounts | null>(null)
  const reviewLogs = ref<ReviewLog[]>([])

  const queue = ref<LearningItem[]>([])
  const queueIndex = ref(0)
  const graded = ref(0)

  const current = computed(() => queue.value[queueIndex.value])
  const remaining = computed(() => Math.max(0, queue.value.length - queueIndex.value))
  const finished = computed(() => queue.value.length > 0 && queueIndex.value >= queue.value.length)

  const curve = computed(() => {
    const days = lastDays(7)
    const counter = new Map<string, number>()
    for (const log of reviewLogs.value) {
      const key = dayKey(log.at)
      counter.set(key, (counter.get(key) ?? 0) + 1)
    }
    return days.map((day) => ({ day, count: counter.get(day) ?? 0 }))
  })

  const streak = computed(() => {
    const active = new Set(reviewLogs.value.map((log) => dayKey(log.at)))
    let days = 0
    const cursor = new Date()
    if (!active.has(dayKey(cursor))) cursor.setDate(cursor.getDate() - 1)
    while (active.has(dayKey(cursor))) {
      days += 1
      cursor.setDate(cursor.getDate() - 1)
    }
    return days
  })

  async function refresh() {
    loading.value = true
    try {
      const page = await repository.page(query)
      items.value = page.items
      total.value = page.total
    } catch (err) {
      platform.pushToast('读取词库失败', 'error')
      console.error(err)
    } finally {
      loading.value = false
    }
  }

  function setQuery(patch: Partial<ItemQuery>) {
    Object.assign(query, patch)
  }

  /** 录入入口：手动 / 批量 / OCR / 其他模块回流统一走这里 */
  async function addItems(
    drafts: ItemDraft[],
    source: ItemSourceModule = 'manual',
    refId?: string,
  ): Promise<{ added: number; duplicates: number }> {
    const created = drafts
      .filter((draft) => draft.ru.trim())
      .map((draft) => createItem({ ...plain(draft), source: { module: source, refId } }))

    if (!created.length) return { added: 0, duplicates: 0 }

    const { added, duplicates } = await repository.bulkAdd(created)
    if (added.length) {
      items.value = [...added, ...items.value]
      total.value += added.length
      bus.emit('item:added', { items: added, source })
    }
    platform.pushToast(
      duplicates.length
        ? `入库 ${added.length} 条，跳过重复 ${duplicates.length} 条`
        : `已入库 ${added.length} 条`,
      duplicates.length ? 'warn' : 'success',
    )
    return { added: added.length, duplicates: duplicates.length }
  }

  async function updateItem(id: string, patch: Partial<LearningItem>) {
    const index = items.value.findIndex((item) => item.id === id)
    const snapshot = index >= 0 ? items.value[index] : undefined
    if (snapshot) items.value[index] = { ...snapshot, ...patch, id }
    try {
      await repository.patch(id, plain(patch))
      bus.emit('item:updated', { id })
    } catch (err) {
      if (snapshot) items.value[index] = snapshot
      platform.pushToast('保存失败，已恢复原值', 'error')
      console.error(err)
    }
  }

  /** 收藏：乐观更新，后台静默落库 */
  function toggleStar(item: LearningItem) {
    void updateItem(item.id, { starred: !item.starred })
  }

  async function removeItem(id: string) {
    const snapshot = [...items.value]
    items.value = items.value.filter((item) => item.id !== id)
    total.value = Math.max(0, total.value - 1)
    try {
      await repository.remove([id])
      bus.emit('item:removed', { ids: [id] })
    } catch (err) {
      items.value = snapshot
      platform.pushToast('删除失败', 'error')
      console.error(err)
    }
  }

  async function loadDue(limit = 80, type: ItemQuery['type'] = 'all') {
    loading.value = true
    try {
      const due = await repository.due(isoNow(), limit * 3)
      const filtered = type === 'all' ? due : due.filter((item) => item.type === type)
      queue.value = shuffle(filtered).slice(0, limit)
      queueIndex.value = 0
      graded.value = 0
    } finally {
      loading.value = false
    }
  }

  /** 评分：先更新界面，再后台持久化；失败仅提示不阻塞流程 */
  function grade(rating: Rating) {
    const item = current.value
    if (!item) return
    const next = srs.schedule(item.srs, rating)
    const updated: LearningItem = { ...item, srs: next }

    queue.value[queueIndex.value] = updated
    const listIndex = items.value.findIndex((entry) => entry.id === item.id)
    if (listIndex >= 0) items.value[listIndex] = updated

    // 不认识：归零并当日重现（移到队尾）
    if (rating === 'unknown') queue.value.push(updated)
    queueIndex.value += 1
    graded.value += 1

    if (queueIndex.value >= queue.value.length) {
      bus.emit('review:finished', { count: graded.value })
    }

    void repository.patch(item.id, { srs: next }).catch((err) => {
      platform.pushToast('复习记录保存失败', 'error')
      console.error(err)
    })
    void repository.logReview({ itemId: item.id, at: isoNow(), rating, box: next.box })
    bus.emit('review:graded', { id: item.id, rating })
  }

  async function loadStats() {
    const [counts, logs] = await Promise.all([
      repository.statusCounts(),
      repository.reviewStats(addDaysIso(new Date(), -30)),
    ])
    stats.value = counts
    reviewLogs.value = logs
  }

  async function exportJson() {
    const [all, logs] = await Promise.all([repository.all(), repository.reviewStats('')])
    downloadFile(`russian-backup-${dayKey()}.json`, JSON.stringify(buildBackup(all, logs)))
  }

  async function exportCsv() {
    const all = await repository.all()
    downloadFile(`russian-words-${dayKey()}.csv`, toCsv(all), 'text/csv')
  }

  async function importBackup(text: string) {
    try {
      const { items: imported, reviewLogs: logs } = parseBackup(text)
      const { added, duplicates } = await repository.bulkAdd(imported)
      for (const log of logs) await repository.logReview(log)
      await refresh()
      await loadStats()
      platform.pushToast(
        `导入完成：新增 ${added.length} 条，跳过 ${duplicates.length} 条`,
        'success',
      )
    } catch (err) {
      platform.pushToast('导入失败：文件格式不正确', 'error')
      console.error(err)
    }
  }

  /** 演示数据：用于验证万级列表性能（可在统计页一键清除） */
  async function seedDemo(count = 10000) {
    const drafts: ItemDraft[] = []
    for (let i = 0; i < count; i += 1) {
      const [ru, zh, pos] = DEMO_WORDS[i % DEMO_WORDS.length]
      const round = Math.floor(i / DEMO_WORDS.length)
      drafts.push({
        ru: round === 0 ? ru : `${ru}${round}`,
        zh,
        pos,
        tags: ['演示'],
      })
    }
    await repository.bulkAdd(drafts.map((draft) => createItem({ ...draft, source: { module: 'manual' } })))
    await refresh()
    await loadStats()
    platform.pushToast(`已生成 ${count} 条演示数据`, 'success')
  }

  async function clearAll() {
    await repository.clearAll()
    items.value = []
    queue.value = []
    queueIndex.value = 0
    total.value = 0
    await loadStats()
    platform.pushToast('已清空本地数据', 'warn')
  }

  return {
    items,
    total,
    loading,
    query,
    stats,
    reviewLogs,
    queue,
    queueIndex,
    graded,
    current,
    remaining,
    finished,
    curve,
    streak,
    refresh,
    setQuery,
    addItems,
    updateItem,
    toggleStar,
    removeItem,
    loadDue,
    grade,
    loadStats,
    exportJson,
    exportCsv,
    importBackup,
    seedDemo,
    clearAll,
  }
})
