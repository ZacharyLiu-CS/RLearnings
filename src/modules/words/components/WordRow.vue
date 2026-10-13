<script setup lang="ts">
import type { LearningItem } from '@/core/types'
import { formatRelativeDue } from '@/core/utils/date'

const props = defineProps<{ item: LearningItem }>()
const emit = defineEmits<{ star: []; edit: []; remove: [] }>()

const STATUS_TEXT: Record<LearningItem['srs']['status'], string> = {
  new: '新学',
  learning: '学习中',
  reviewing: '复习中',
  mastered: '已掌握',
}
</script>

<template>
  <div class="word-row">
    <div class="word-main">
      <div class="word-head">
        <span class="title-ru">{{ props.item.ru }}</span>
        <span v-if="props.item.stress" class="faint">{{ props.item.stress }}</span>
        <span v-if="props.item.pos" class="badge">{{ props.item.pos }}</span>
        <span v-if="props.item.source.module !== 'manual'" class="badge">
          {{ props.item.source.module }}
        </span>
      </div>
      <div class="word-sub muted">
        {{ props.item.zh || '（未填写释义）' }}
        <span v-if="props.item.tags.length" class="faint"> · {{ props.item.tags.join(' / ') }}</span>
      </div>
    </div>

    <div class="word-meta">
      <span :class="['badge', `badge-${props.item.srs.status}`]">
        {{ STATUS_TEXT[props.item.srs.status] }}
      </span>
      <span class="faint">box {{ props.item.srs.box }} · {{ formatRelativeDue(props.item.srs.nextReview) }}</span>
    </div>

    <div class="word-actions">
      <button class="icon-btn" :title="props.item.starred ? '取消收藏' : '收藏'" @click="emit('star')">
        {{ props.item.starred ? '★' : '☆' }}
      </button>
      <button class="icon-btn" title="编辑" @click="emit('edit')">✎</button>
      <button class="icon-btn danger" title="删除" @click="emit('remove')">🗑</button>
    </div>
  </div>
</template>

<style scoped>
.word-row {
  height: 100%;
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 10px 14px;
  border-bottom: 1px solid var(--border);
}

.word-main {
  min-width: 0;
  flex: 1;
}

.word-head {
  display: flex;
  align-items: baseline;
  gap: 8px;
}

.word-sub {
  font-size: 13px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.word-meta {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 2px;
  font-size: 12px;
  flex: 0 0 auto;
}

.word-actions {
  display: flex;
  gap: 4px;
  flex: 0 0 auto;
}

.icon-btn {
  width: 34px;
  height: 34px;
  display: grid;
  place-items: center;
  border-radius: 8px;
  border: 1px solid transparent;
  background: transparent;
  color: var(--text-dim);
  transition: background 0.14s ease, color 0.14s ease;
}

.icon-btn:hover {
  background: var(--bg-soft);
  color: var(--text);
}

.icon-btn.danger:hover {
  color: var(--danger);
}

@media (max-width: 820px) {
  .word-meta {
    display: none;
  }
}
</style>
