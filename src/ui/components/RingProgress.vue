<script setup lang="ts">
/**
 * Apple 运动圆环风格的进度环（SVG 实现）：
 * - 支持单环（复习进度）与多环同心（统计三环）
 * - 进度用 stroke-dashoffset 动画，走合成层，过渡顺滑
 * - complete 时切换为满环配色并播放一次「达成」脉冲
 */
import { computed, useId } from 'vue'

export interface RingSpec {
  /** 0 - 1 */
  progress: number
  from: string
  to: string
}

const props = withDefaults(
  defineProps<{
    progress?: number
    rings?: RingSpec[]
    size?: number
    thickness?: number
    gap?: number
    complete?: boolean
    track?: string
  }>(),
  {
    progress: 0,
    size: 168,
    thickness: 14,
    gap: 5,
    track: 'rgba(17, 17, 17, 0.08)',
  },
)

const uid = useId()

const items = computed<RingSpec[]>(() =>
  props.rings && props.rings.length
    ? props.rings
    : [{ progress: props.progress, from: 'var(--accent)', to: '#ff9500' }],
)

const center = computed(() => props.size / 2)

function radius(index: number): number {
  return center.value - props.thickness / 2 - index * (props.thickness + props.gap)
}

function circumference(index: number): number {
  return 2 * Math.PI * radius(index)
}

function clamp(value: number): number {
  return Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0))
}

function offset(index: number): number {
  const ring = items.value[index]
  return circumference(index) * (1 - clamp(ring.progress))
}

function isEmpty(index: number): boolean {
  return clamp(items.value[index].progress) <= 0.001
}
</script>

<template>
  <div
    class="ring"
    :class="{ 'is-complete': complete }"
    :style="{ width: `${size}px`, height: `${size}px` }"
  >
    <svg :width="size" :height="size" :viewBox="`0 0 ${size} ${size}`">
      <defs>
        <linearGradient
          v-for="(ring, index) in items"
          :key="index"
          :id="`ring-${uid}-${index}`"
          x1="0"
          y1="0"
          x2="1"
          y2="1"
        >
          <stop offset="0%" :style="{ stopColor: ring.from }" />
          <stop offset="100%" :style="{ stopColor: ring.to }" />
        </linearGradient>
      </defs>

      <g :transform="`rotate(-90 ${center} ${center})`">
        <circle
          v-for="(_ring, index) in items"
          :key="`track-${index}`"
          class="track"
          :cx="center"
          :cy="center"
          :r="radius(index)"
          :stroke="track"
          :stroke-width="thickness"
          fill="none"
        />
        <circle
          v-for="(_ring, index) in items"
          :key="`bar-${index}`"
          class="bar"
          :class="{ 'is-empty': isEmpty(index) }"
          :cx="center"
          :cy="center"
          :r="radius(index)"
          :stroke="`url(#ring-${uid}-${index})`"
          :stroke-width="thickness"
          :stroke-dasharray="circumference(index)"
          :stroke-dashoffset="offset(index)"
          stroke-linecap="round"
          fill="none"
        />
      </g>
    </svg>

    <div class="center">
      <slot />
    </div>
  </div>
</template>

<style scoped>
.ring {
  position: relative;
  display: grid;
  place-items: center;
  flex: 0 0 auto;
}

.ring svg {
  display: block;
  transition: filter 0.3s linear;
}

.bar {
  /* 环前进是「位移类」动效：页面级时长 + ease-out 收敛 */
  transition: stroke-dashoffset var(--dur-4) var(--ease-out);
}

.bar.is-empty {
  opacity: 0;
}

.center {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  text-align: center;
}

/* 满环：发光 + 一次脉冲，给用户明确的正反馈 */
.is-complete svg {
  filter: drop-shadow(0 0 10px rgba(15, 107, 79, 0.35));
  animation: ring-pop var(--dur-4) var(--spring);
}

@keyframes ring-pop {
  0% {
    transform: scale(1);
  }
  45% {
    transform: scale(1.045);
  }
  100% {
    transform: scale(1);
  }
}

@media (prefers-reduced-motion: reduce) {
  .bar {
    transition: none;
  }
  .is-complete svg {
    animation: none;
  }
}
</style>
