<script setup lang="ts">
import type { LearningItem } from '@/core/types'

const props = defineProps<{ item: LearningItem; flipped: boolean }>()
const emit = defineEmits<{ (e: 'flip'): void }>()
</script>

<template>
  <div class="card3d" @click="emit('flip')">
    <div :class="['inner', props.flipped && 'is-flipped']">
      <div class="face front">
        <div class="title-ru" style="font-size: 34px">{{ props.item.ru }}</div>
        <div v-if="props.item.stress" class="faint">{{ props.item.stress }}</div>
        <div class="faint hint">空格 / 点击翻面</div>
      </div>
      <div class="face back">
        <div class="title-ru" style="font-size: 26px">{{ props.item.ru }}</div>
        <div class="zh">{{ props.item.zh || '（暂无释义）' }}</div>
        <div v-if="props.item.forms" class="muted" style="font-size: 13px">
          {{ props.item.forms }}
        </div>
        <div v-if="props.item.example" class="muted example">{{ props.item.example }}</div>
        <div v-if="props.item.tags.length" class="row" style="justify-content: center; flex-wrap: wrap">
          <span v-for="tag in props.item.tags" :key="tag" class="badge">{{ tag }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.card3d {
  perspective: 1200px;
  height: 320px;
  cursor: pointer;
}

.inner {
  position: relative;
  height: 100%;
  transition: transform 0.32s cubic-bezier(0.2, 0.8, 0.2, 1);
  transform-style: preserve-3d;
}

.inner.is-flipped {
  transform: rotateY(180deg);
}

.face {
  position: absolute;
  inset: 0;
  border-radius: var(--radius);
  border: 1px solid var(--border);
  background: var(--bg-elevated);
  backface-visibility: hidden;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 24px;
  text-align: center;
  overflow: hidden;
}

.back {
  transform: rotateY(180deg);
}

.zh {
  font-size: 22px;
}

.example {
  font-size: 13px;
  font-style: italic;
}

.hint {
  position: absolute;
  bottom: 14px;
  font-size: 12px;
}
</style>
