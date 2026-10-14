<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useWordsStore } from '../store'
import { usePlatformStore } from '@/core/stores/platform'
import { dayKey } from '@/core/utils/date'
import RingProgress from '@/ui/components/RingProgress.vue'

const store = useWordsStore()
const platform = usePlatformStore()
const fileRef = ref<HTMLInputElement | null>(null)

/** 每日复习目标（张），用于圆环进度 */
const DAILY_GOAL = 20

const todayCount = computed(
  () => store.reviewLogs.filter((log) => dayKey(log.at) === dayKey()).length,
)
const masteredPct = computed(() => {
  const total = store.stats?.total ?? 0
  if (!total) return 0
  return Math.round(((store.stats?.byStatus.mastered ?? 0) / total) * 100)
})

/** Apple 三环：今日复习 / 连续打卡 / 掌握率 */
const rings = computed(() => [
  {
    progress: Math.min(1, todayCount.value / DAILY_GOAL),
    from: 'var(--accent)',
    to: '#ff9500',
  },
  { progress: Math.min(1, store.streak / 7), from: '#1a4cd0', to: '#4f8cff' },
  {
    progress: (store.stats?.byStatus.mastered ?? 0) / Math.max(1, store.stats?.total ?? 1),
    from: '#0f6b4f',
    to: '#3ecf8e',
  },
])

const STATUS_ROWS = [
  { key: 'new', label: '新学', color: '#9db8ff' },
  { key: 'learning', label: '学习中', color: '#ffb020' },
  { key: 'reviewing', label: '复习中', color: '#7ee0c0' },
  { key: 'mastered', label: '已掌握', color: '#3ecf8e' },
] as const

const maxCurve = computed(() => Math.max(1, ...store.curve.map((point) => point.count)))

async function onImport(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  await store.importBackup(await file.text())
}

function confirmClear() {
  if (window.confirm('将清空本机全部学习数据与复习记录，且不可恢复。确定继续？')) {
    void store.clearAll()
  }
}

onMounted(() => void store.loadStats())
</script>

<template>
  <div class="stats">
    <div class="cards">
      <div class="card metric">
        <span class="faint">总条目</span>
        <strong>{{ store.stats?.total ?? 0 }}</strong>
      </div>
      <div class="card metric">
        <span class="faint">今日待复习</span>
        <strong style="color: var(--warn)">{{ store.stats?.due ?? 0 }}</strong>
      </div>
      <div class="card metric">
        <span class="faint">已掌握</span>
        <strong style="color: var(--success)">{{ store.stats?.byStatus.mastered ?? 0 }}</strong>
      </div>
      <div class="card metric">
        <span class="faint">连续打卡</span>
        <strong>{{ store.streak }} 天</strong>
      </div>
    </div>

    <div class="card">
      <h3 style="margin: 0 0 14px; font-size: 15px">今日圆环</h3>
      <div class="ring-row">
        <RingProgress :rings="rings" :size="152" :thickness="12" :gap="4">
          <strong class="ring-value">{{ todayCount }}</strong>
          <span class="micro">/ {{ DAILY_GOAL }} 张</span>
        </RingProgress>
        <div class="legend">
          <div class="legend-item">
            <span class="dot dot-a" />
            <span class="muted">今日复习 {{ todayCount }} / {{ DAILY_GOAL }}</span>
          </div>
          <div class="legend-item">
            <span class="dot dot-b" />
            <span class="muted">连续打卡 {{ store.streak }} / 7 天</span>
          </div>
          <div class="legend-item">
            <span class="dot dot-c" />
            <span class="muted">掌握率 {{ masteredPct }}%</span>
          </div>
        </div>
      </div>
    </div>

    <div class="card">
      <h3 style="margin: 0 0 14px; font-size: 15px">近 7 天复习量</h3>
      <div class="curve">
        <div v-for="point in store.curve" :key="point.day" class="curve-col">
          <div class="curve-bar-wrap">
            <div
              class="curve-bar"
              :style="{ height: `${(point.count / maxCurve) * 100}%` }"
              :title="`${point.count} 次`"
            />
          </div>
          <span class="faint">{{ point.day.slice(5) }}</span>
          <span class="faint" style="font-size: 11px">{{ point.count }}</span>
        </div>
      </div>
    </div>

    <div class="card">
      <h3 style="margin: 0 0 14px; font-size: 15px">掌握进度分布</h3>
      <div v-for="row in STATUS_ROWS" :key="row.key" class="dist-row">
        <span class="faint" style="width: 60px">{{ row.label }}</span>
        <div class="dist-track">
          <div
            class="dist-fill"
            :style="{
              width: `${((store.stats?.byStatus[row.key] ?? 0) / Math.max(1, store.stats?.total ?? 1)) * 100}%`,
              background: row.color,
            }"
          />
        </div>
        <span class="muted" style="width: 44px; text-align: right">
          {{ store.stats?.byStatus[row.key] ?? 0 }}
        </span>
      </div>
    </div>

    <div class="card">
      <h3 style="margin: 0 0 14px; font-size: 15px">数据管理</h3>
      <div class="row" style="flex-wrap: wrap; gap: 8px">
        <button class="btn" type="button" @click="store.exportJson()">导出 JSON 备份</button>
        <button class="btn" type="button" @click="store.exportCsv()">导出 CSV</button>
        <button class="btn" type="button" @click="fileRef?.click()">导入备份</button>
        <button class="btn" type="button" @click="store.seedDemo(10000)">生成 1 万条演示数据</button>
        <button class="btn btn-danger" type="button" @click="confirmClear">清空数据</button>
      </div>
      <p class="faint" style="font-size: 12px; margin: 12px 0 0">
        当前存储后端：{{ platform.dbStatus === 'ok' ? 'IndexedDB（本地持久化）' : '内存态（刷新即失，请及时导出）' }}
      </p>
      <input ref="fileRef" type="file" accept="application/json" hidden @change="onImport" />
    </div>
  </div>
</template>

<style scoped>
.stats {
  display: flex;
  flex-direction: column;
  gap: 14px;
  overflow: auto;
  padding-bottom: 20px;
}

.cards {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
}

.ring-row {
  display: flex;
  align-items: center;
  gap: 24px;
  flex-wrap: wrap;
}

.ring-value {
  font-size: 30px;
  font-weight: 700;
  letter-spacing: -0.02em;
  line-height: 1;
}

.legend {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-width: 180px;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 13px;
}

.dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex: 0 0 auto;
}

.dot-a {
  background: var(--accent);
}

.dot-b {
  background: #1a4cd0;
}

.dot-c {
  background: #0f6b4f;
}

.metric {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.metric strong {
  font-size: 26px;
}

.curve {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 8px;
  height: 160px;
}

.curve-col {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  height: 100%;
}

.curve-bar-wrap {
  flex: 1;
  width: 100%;
  display: flex;
  align-items: flex-end;
}

.curve-bar {
  width: 100%;
  border-radius: 6px 6px 0 0;
  background: linear-gradient(180deg, var(--accent), rgba(79, 140, 255, 0.25));
  min-height: 3px;
  transition: height 0.24s ease;
}

.dist-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 8px;
  font-size: 13px;
}

.dist-track {
  flex: 1;
  height: 8px;
  border-radius: 999px;
  background: var(--bg-soft);
  overflow: hidden;
}

.dist-fill {
  height: 100%;
  transition: width 0.24s ease;
}

@media (max-width: 700px) {
  .cards {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>
