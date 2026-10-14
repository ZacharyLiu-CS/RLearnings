<script setup lang="ts">
/**
 * 文字出现特效：
 * - ink（水墨晕染）：从笔画中心以径向遮罩扩散 + 模糊消散，逐字/逐词错峰
 * - rise（上浮淡入）：轻量版，用于释义、标签等次要文本
 * 遵循 Apple 动效规范：进入用 ease-out，时长控制在 320–480ms，不循环、不装饰。
 */
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    text: string
    /** ink 水墨晕染 / rise 上浮淡入 */
    mode?: 'ink' | 'rise'
    /** 每项之间的错峰间隔（ms） */
    stagger?: number
    /** 整体延迟（ms） */
    delay?: number
    /** char 逐字 / word 逐词 / auto 有空格则逐词 */
    unit?: 'char' | 'word' | 'auto'
  }>(),
  { mode: 'ink', stagger: 34, delay: 0, unit: 'auto' },
)

interface Token {
  value: string
  /** 分隔符（空格）不参与动画 */
  separator: boolean
}

const tokens = computed<Token[]>(() => {
  const source = props.text ?? ''
  const byWord = props.unit === 'word' || (props.unit === 'auto' && /\s/.test(source.trim()))
  if (byWord) {
    return source
      .split(/(\s+)/)
      .filter((part) => part.length > 0)
      .map((part) => ({ value: part, separator: /^\s+$/.test(part) }))
  }
  return [...source].map((char) => ({ value: char, separator: char === ' ' }))
})

function delayOf(index: number): string {
  return `${props.delay + index * props.stagger}ms`
}
</script>

<template>
  <span class="reveal" :class="`reveal-${mode}`">
    <span
      v-for="(token, index) in tokens"
      :key="index"
      :class="['reveal-token', { 'is-sep': token.separator }]"
      :style="{ animationDelay: delayOf(index) }"
      >{{ token.value }}</span
    >
  </span>
</template>

<style scoped>
.reveal {
  display: inline;
}

.reveal-token {
  display: inline-block;
  white-space: pre;
  will-change: opacity, transform, filter;
}

.reveal-token.is-sep {
  animation: none !important;
}

/* 水墨晕染：遮罩自中心扩散 + 模糊消散 + 轻微上浮 */
.reveal-ink .reveal-token:not(.is-sep) {
  opacity: 0;
  filter: blur(8px);
  transform: translate3d(0, 4px, 0) scale(0.98);
  -webkit-mask-image: radial-gradient(
    circle at 50% 62%,
    #000 32%,
    rgba(0, 0, 0, 0.45) 58%,
    transparent 78%
  );
  mask-image: radial-gradient(
    circle at 50% 62%,
    #000 32%,
    rgba(0, 0, 0, 0.45) 58%,
    transparent 78%
  );
  -webkit-mask-repeat: no-repeat;
  mask-repeat: no-repeat;
  -webkit-mask-position: center;
  mask-position: center;
  -webkit-mask-size: 0% 0%;
  mask-size: 0% 0%;
  animation: ink-diffuse var(--dur-4) var(--ease-out) both;
}

@keyframes ink-diffuse {
  0% {
    opacity: 0;
    filter: blur(8px);
    transform: translate3d(0, 4px, 0) scale(0.98);
    -webkit-mask-size: 0% 0%;
    mask-size: 0% 0%;
  }
  55% {
    opacity: 1;
  }
  100% {
    opacity: 1;
    filter: blur(0);
    transform: none;
    -webkit-mask-size: 320% 320%;
    mask-size: 320% 320%;
  }
}

/* 上浮淡入：次要文本的轻量版本 */
.reveal-rise .reveal-token:not(.is-sep) {
  opacity: 0;
  transform: translate3d(0, 8px, 0);
  animation: rise-in var(--dur-3) var(--ease-out) both;
}

@keyframes rise-in {
  from {
    opacity: 0;
    transform: translate3d(0, 8px, 0);
  }
  to {
    opacity: 1;
    transform: none;
  }
}

@media (prefers-reduced-motion: reduce) {
  .reveal-token {
    opacity: 1 !important;
    filter: none !important;
    transform: none !important;
    -webkit-mask-size: 320% 320% !important;
    mask-size: 320% 320% !important;
    animation: none !important;
  }
}
</style>
