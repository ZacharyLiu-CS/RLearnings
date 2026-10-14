<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useWordsStore } from '../store'
import type { ItemQuery } from '@/core/db/repository'
import type { Rating } from '@/core/types'
import FlashCard from '../components/FlashCard.vue'
import SkeletonRows from '@/ui/components/SkeletonRows.vue'
import EmptyState from '@/ui/components/EmptyState.vue'
import RingProgress from '@/ui/components/RingProgress.vue'
import TextReveal from '@/ui/components/TextReveal.vue'
import AppIcon from '@/ui/components/AppIcon.vue'

const store = useWordsStore()
const router = useRouter()
const flipped = ref(false)
const scope = ref<NonNullable<ItemQuery['type']>>('all')

/** 本组完成度：用于圆环进度 */
const ratio = computed(() =>
  store.queue.length ? Math.min(1, store.queueIndex / store.queue.length) : 0,
)
const percent = computed(() => Math.round(ratio.value * 100))

const RATINGS: Array<{ key: Rating; label: string; hint: string; tone: string }> = [
  { key: 'unknown', label: '不认识', hint: '1', tone: 'danger' },
  { key: 'fuzzy', label: '模糊', hint: '2', tone: 'warn' },
  { key: 'known', label: '认识', hint: '3', tone: 'success' },
]

function flip() {
  if (store.current) flipped.value = !flipped.value
}

function grade(rating: Rating) {
  if (!store.current) return
  store.grade(rating)
  flipped.value = false
}

function onKeydown(event: KeyboardEvent) {
  if (event.metaKey || event.ctrlKey || event.altKey) return
  if (event.code === 'Space') {
    event.preventDefault()
    flip()
    return
  }
  const rating = RATINGS.find((item) => item.hint === event.key)
  if (rating) {
    event.preventDefault()
    grade(rating.key)
  }
}

function reload() {
  flipped.value = false
  void store.loadDue(80, scope.value)
  void store.loadStats()
}

watch(scope, reload)
watch(() => store.current?.id, () => (flipped.value = false))
// 满环后刷新统计，让奖励卡片显示最新的连续打卡天数
watch(
  () => store.finished,
  (finished) => {
    if (finished) void store.loadStats()
  },
)

onMounted(() => {
  window.addEventListener('keydown', onKeydown)
  void store.loadStats()
  if (!store.queue.length) void store.loadDue(80, scope.value)
})

onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown))
</script>

<template>
  <div class="review">
    <div class="bar">
      <select v-model="scope" class="select" style="max-width: 120px">
        <option value="all">全部</option>
        <option value="word">仅单词</option>
        <option value="sentence">仅句子</option>
      </select>
      <div class="spacer" />
      <span class="faint micro">{{ percent }}% · 剩余 {{ store.remaining }}</span>
      <button class="btn btn-ghost" type="button" @click="reload">换一组</button>
    </div>

    <div class="ring-area">
      <div class="ring-wrap">
        <RingProgress :progress="ratio" :complete="store.finished" :size="148">
          <template v-if="store.finished">
            <span class="ring-check"><AppIcon name="check" :size="30" /></span>
            <span class="micro">满环</span>
          </template>
          <template v-else>
            <!-- 数字切换：上推替换，走 spring 曲线 -->
            <Transition name="num" mode="out-in">
              <strong :key="store.remaining" class="ring-value">{{ store.remaining }}</strong>
            </Transition>
            <span class="micro">待复习</span>
          </template>
        </RingProgress>

        <!-- 满环奖励：一次性的粒子迸发 -->
        <div v-if="store.finished" class="burst" aria-hidden="true">
          <span v-for="i in 10" :key="i" :style="{ '--a': `${(i - 1) * 36}deg`, 'animation-delay': `${i * 30}ms` }" />
        </div>
      </div>

      <div class="ring-legend">
        <span class="micro">本组进度</span>
        <span class="muted legend-value">{{ store.graded }} / {{ store.queue.length || 0 }} 张</span>
      </div>
    </div>

    <SkeletonRows v-if="store.loading" :rows="1" :height="320" />

    <div v-else-if="store.finished" class="card reward enter-up-delayed">
      <div class="row reward-head">
        <AppIcon name="check" :size="18" />
        <strong><TextReveal text="满环达成" mode="ink" :stagger="46" /></strong>
        <span class="badge badge-mastered">+{{ store.graded }} 张</span>
      </div>
      <p class="muted reward-text">
        本组 {{ store.graded }} 张卡片已完成，连续打卡 {{ store.streak }} 天。复习记录已写入本地。
      </p>
      <div class="row">
        <button class="btn btn-primary" type="button" @click="reload">再来一组</button>
        <button class="btn" type="button" @click="router.push({ name: 'words-library' })">
          回到词库
        </button>
      </div>
    </div>

    <EmptyState
      v-else-if="!store.current"
      title="当前没有待复习内容"
      description="到点再来，或先去录入新内容。"
      action-label="去录入"
      @action="router.push({ name: 'words-add' })"
    />

    <template v-else>
      <div :key="store.current?.id ?? 'none'" class="card-enter">
        <FlashCard :item="store.current" :flipped="flipped" @flip="flip" />
      </div>

      <div class="ratings">
        <button
          v-for="item in RATINGS"
          :key="item.key"
          class="btn rate"
          :class="`rate-${item.tone}`"
          type="button"
          @click="grade(item.key)"
        >
          {{ item.label }}
          <kbd>{{ item.hint }}</kbd>
        </button>
      </div>

      <p class="faint hint-line">空格翻面 · 1/2/3 评分 · 不认识的条目会在本组内重现</p>
    </template>
  </div>
</template>

<style scoped>
.review {
  display: flex;
  flex-direction: column;
  gap: 16px;
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding-bottom: 20px;
}

.bar {
  display: flex;
  align-items: center;
  gap: 12px;
}

.ring-area {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 4px 0 8px;
}

.ring-wrap {
  position: relative;
  display: grid;
  place-items: center;
}

.ring-value {
  font-size: 34px;
  font-weight: 700;
  letter-spacing: -0.02em;
  line-height: 1;
}

.ring-check {
  color: #0f6b4f;
  display: grid;
  place-items: center;
}

.ring-legend {
  display: flex;
  align-items: baseline;
  gap: 10px;
}

.legend-value {
  font-size: 13px;
}

.burst {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  pointer-events: none;
}

.burst span {
  position: absolute;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--accent);
  opacity: 0;
  /* 迸发是一次性强调动效：ease-out 减速 + 轻缩放收敛 */
  animation: burst-out var(--dur-4) var(--ease-out) forwards;
}

@keyframes burst-out {
  0% {
    opacity: 1;
    transform: rotate(var(--a)) translateY(-46px) scale(0.6);
  }
  35% {
    opacity: 1;
    transform: rotate(var(--a)) translateY(-70px) scale(1);
  }
  100% {
    opacity: 0;
    transform: rotate(var(--a)) translateY(-102px) scale(0.4);
  }
}

.card-enter {
  animation: card-enter var(--dur-3) var(--ease-out) both;
}

@keyframes card-enter {
  from {
    opacity: 0;
    transform: translate3d(0, 12px, 0) scale(0.985);
  }
  to {
    opacity: 1;
    transform: none;
  }
}

.reward {
  border-left: 3px solid #0f6b4f;
}

.reward-head {
  gap: 10px;
  color: #0f6b4f;
}

.reward-text {
  font-size: 13px;
  margin: 10px 0 16px;
}

.ratings {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
}

.rate {
  flex-direction: column;
  gap: 2px;
  min-height: 56px;
}

.rate kbd {
  font-size: 11px;
  padding: 1px 6px;
  border-radius: 6px;
  background: rgba(17, 17, 17, 0.08);
}

.rate-danger {
  border-color: rgba(212, 50, 31, 0.5);
}
.rate-warn {
  border-color: rgba(163, 90, 0, 0.5);
}
.rate-success {
  border-color: rgba(15, 107, 79, 0.5);
}

.hint-line {
  text-align: center;
  font-size: 12px;
  margin: 0;
}
</style>
