<script setup lang="ts">
import type { LearningItem } from '@/core/types'
import TextReveal from '@/ui/components/TextReveal.vue'

const props = defineProps<{ item: LearningItem; flipped: boolean }>()
const emit = defineEmits<{ (e: 'flip'): void }>()
</script>

<template>
  <div class="card3d" @click="emit('flip')">
    <div :class="['inner', props.flipped && 'is-flipped']">
      <div class="face front">
        <!-- 俄文用水墨晕染逐词出现，切换卡片时随 key 重播 -->
        <TextReveal :key="`ru-${props.item.id}`" class="title-ru flash-ru" :text="props.item.ru" mode="ink" />
        <div v-if="props.item.stress" class="faint">
          <TextReveal :key="`st-${props.item.id}`" :text="props.item.stress" mode="rise" :delay="180" />
        </div>
        <div class="faint hint">空格 / 点击翻面</div>
      </div>

      <div class="face back">
        <TextReveal
          :key="`ru2-${props.item.id}`"
          class="title-ru flash-ru-small"
          :text="props.item.ru"
          mode="rise"
          :stagger="22"
        />
        <div class="zh">
          <TextReveal :key="`zh-${props.item.id}`" :text="props.item.zh || '（暂无释义）'" mode="ink" :delay="120" />
        </div>
        <div v-if="props.item.forms" class="muted small">
          <TextReveal :key="`fm-${props.item.id}`" :text="props.item.forms" mode="rise" :delay="240" />
        </div>
        <div v-if="props.item.example" class="muted example">
          <TextReveal :key="`ex-${props.item.id}`" :text="props.item.example" mode="rise" :delay="300" />
        </div>
        <div v-if="props.item.tags.length" class="row tags">
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
  /* 翻面是对称位移：用 ease-in-out，卡片级时长 */
  transition: transform var(--dur-3) var(--ease-in-out);
  transform-style: preserve-3d;
}

.inner.is-flipped {
  transform: rotateY(180deg);
}

.face {
  position: absolute;
  inset: 0;
  border-radius: 2px;
  border: 1px solid var(--line);
  background: var(--paper);
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

.flash-ru {
  font-size: 34px;
}

.flash-ru-small {
  font-size: 26px;
}

.zh {
  font-size: 22px;
}

.small {
  font-size: 13px;
}

.example {
  font-size: 13px;
  font-style: italic;
}

.tags {
  justify-content: center;
  flex-wrap: wrap;
}

.hint {
  position: absolute;
  bottom: 14px;
  font-size: 12px;
  opacity: 0;
  animation: hint-in var(--dur-4) var(--ease-out) 600ms both;
}

@keyframes hint-in {
  from {
    opacity: 0;
    transform: translate3d(0, 4px, 0);
  }
  to {
    opacity: 1;
    transform: none;
  }
}

@media (prefers-reduced-motion: reduce) {
  .inner {
    transition: none;
  }
}
</style>
