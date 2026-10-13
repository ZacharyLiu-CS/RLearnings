<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useWordsStore } from '../store'
import type { ItemQuery } from '@/core/db/repository'
import type { Rating } from '@/core/types'
import FlashCard from '../components/FlashCard.vue'
import SkeletonRows from '@/ui/components/SkeletonRows.vue'
import EmptyState from '@/ui/components/EmptyState.vue'

const store = useWordsStore()
const router = useRouter()
const flipped = ref(false)
const scope = ref<NonNullable<ItemQuery['type']>>('all')

const progress = computed(() =>
  store.queue.length ? Math.min(1, store.queueIndex / store.queue.length) : 0,
)

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
}

watch(scope, reload)
watch(() => store.current?.id, () => (flipped.value = false))

onMounted(() => {
  window.addEventListener('keydown', onKeydown)
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
      <div class="progress">
        <div class="progress-fill" :style="{ transform: `scaleX(${progress})` }" />
      </div>
      <span class="faint">剩余 {{ store.remaining }}</span>
      <button class="btn btn-ghost" type="button" @click="reload">换一组</button>
    </div>

    <SkeletonRows v-if="store.loading" :rows="1" :height="320" />

    <template v-else-if="store.finished">
      <div class="card finish">
        <h2 style="margin: 0 0 6px">本组完成 🎉</h2>
        <p class="muted" style="margin: 0 0 16px">已完成 {{ store.graded }} 次评分，数据已写入本地。</p>
        <div class="row" style="justify-content: center">
          <button class="btn btn-primary" type="button" @click="reload">再来一组</button>
          <button class="btn" type="button" @click="router.push({ name: 'words-library' })">
            回到词库
          </button>
        </div>
      </div>
    </template>

    <EmptyState
      v-else-if="!store.current"
      title="当前没有待复习内容"
      description="到点再来，或先去录入新内容。"
      action-label="去录入"
      @action="router.push({ name: 'words-add' })"
    />

    <template v-else>
      <FlashCard :item="store.current" :flipped="flipped" @flip="flip" />

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
}

.bar {
  display: flex;
  align-items: center;
  gap: 12px;
}

.progress {
  flex: 1;
  height: 6px;
  border-radius: 999px;
  background: var(--bg-soft);
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: var(--accent);
  transform-origin: left center;
  transition: transform 0.2s ease;
}

.finish {
  text-align: center;
  margin: auto 0;
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
  background: rgba(255, 255, 255, 0.08);
}

.rate-danger {
  border-color: rgba(255, 92, 92, 0.4);
}
.rate-warn {
  border-color: rgba(255, 176, 32, 0.4);
}
.rate-success {
  border-color: rgba(62, 207, 142, 0.4);
}

.hint-line {
  text-align: center;
  font-size: 12px;
  margin: 0;
}
</style>
