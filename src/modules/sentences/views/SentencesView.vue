<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { createItem, repository } from '@/core/db/repository'
import { bus } from '@/core/event-bus'
import { usePlatformStore } from '@/core/stores/platform'
import type { LearningItem } from '@/core/types'
import { formatRelativeDue } from '@/core/utils/date'
import EmptyState from '@/ui/components/EmptyState.vue'

const platform = usePlatformStore()
const items = ref<LearningItem[]>([])
const ru = ref('')
const zh = ref('')

async function load() {
  const page = await repository.page({ type: 'sentence', limit: 200 })
  items.value = page.items
}

async function add() {
  if (!ru.value.trim()) return
  const item = createItem({
    type: 'sentence',
    ru: ru.value.trim(),
    zh: zh.value.trim() || undefined,
    tags: ['句子'],
    source: { module: 'manual' },
  })
  const { added } = await repository.bulkAdd([item])
  if (added.length) {
    items.value = [item, ...items.value]
    bus.emit('item:added', { items: added, source: 'manual' })
    platform.pushToast('句子已收藏，可在复习页「仅句子」中复习', 'success')
  } else {
    platform.pushToast('已存在相同句子', 'warn')
  }
  ru.value = ''
  zh.value = ''
}

async function remove(id: string) {
  await repository.remove([id])
  items.value = items.value.filter((item) => item.id !== id)
}

onMounted(load)
</script>

<template>
  <div class="sentences">
    <div class="card">
      <div class="row" style="gap: 8px; flex-wrap: wrap">
        <input
          v-model="ru"
          class="input"
          style="flex: 2; min-width: 220px"
          placeholder="俄语句子，例如：Я изучаю русский язык."
        />
        <input v-model="zh" class="input" style="flex: 1; min-width: 160px" placeholder="中文翻译（可选）" />
        <button class="btn btn-primary" type="button" @click="add">收藏句子</button>
      </div>
      <p class="faint" style="font-size: 12px; margin: 10px 0 0">
        本模块未修改任何核心代码：复用统一 LearningItem 模型与 SRS 调度器，句子自动进入复习体系。
      </p>
    </div>

    <div class="card list">
      <EmptyState v-if="!items.length" title="还没有收藏句子" description="添加一句试试。" />
      <div v-for="item in items" :key="item.id" class="sentence-row">
        <div style="min-width: 0">
          <div class="title-ru" style="font-size: 16px">{{ item.ru }}</div>
          <div class="muted" style="font-size: 13px">{{ item.zh || '—' }}</div>
        </div>
        <div class="row" style="flex: 0 0 auto">
          <span class="faint" style="font-size: 12px">
            box {{ item.srs.box }} · {{ formatRelativeDue(item.srs.nextReview) }}
          </span>
          <button class="btn btn-ghost" type="button" @click="remove(item.id)">删除</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.sentences {
  display: flex;
  flex-direction: column;
  gap: 14px;
  overflow: auto;
  padding-bottom: 20px;
}

.list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.sentence-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--border);
}

.sentence-row:last-child {
  border-bottom: none;
  padding-bottom: 0;
}
</style>
