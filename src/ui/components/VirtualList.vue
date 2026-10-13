<script setup lang="ts" generic="T">
/**
 * 定高虚拟滚动列表：万级数据只渲染视口内行，滚动走 transform（合成层）。
 */
import { computed, onBeforeUnmount, ref } from 'vue'

const props = withDefaults(
  defineProps<{
    items: T[]
    itemHeight: number
    overscan?: number
  }>(),
  { overscan: 6 },
)

const viewport = ref<HTMLElement | null>(null)
const scrollTop = ref(0)
const viewportHeight = ref(600)
let frame = 0

function onScroll() {
  if (frame) return
  frame = requestAnimationFrame(() => {
    frame = 0
    const el = viewport.value
    if (!el) return
    scrollTop.value = el.scrollTop
    viewportHeight.value = el.clientHeight
  })
}

onBeforeUnmount(() => {
  if (frame) cancelAnimationFrame(frame)
})

const total = computed(() => props.items.length)
const totalHeight = computed(() => total.value * props.itemHeight)
const startIndex = computed(() =>
  Math.max(0, Math.floor(scrollTop.value / props.itemHeight) - props.overscan),
)
const endIndex = computed(() =>
  Math.min(total.value, Math.ceil((scrollTop.value + viewportHeight.value) / props.itemHeight) + props.overscan),
)
const offsetY = computed(() => startIndex.value * props.itemHeight)
const windowRows = computed(() =>
  props.items.slice(startIndex.value, endIndex.value).map((item, i) => ({
    item,
    index: startIndex.value + i,
  })),
)

defineExpose({
  scrollToTop() {
    viewport.value?.scrollTo({ top: 0 })
  },
})
</script>

<template>
  <div ref="viewport" class="virtual-viewport" @scroll.passive="onScroll">
    <div class="virtual-spacer" :style="{ height: `${totalHeight}px` }">
      <div class="virtual-window" :style="{ transform: `translateY(${offsetY}px)` }">
        <div
          v-for="row in windowRows"
          :key="row.index"
          :style="{ height: `${itemHeight}px` }"
        >
          <slot :item="row.item" :index="row.index" />
        </div>
      </div>
    </div>
    <div v-if="!total" style="padding: 40px 0">
      <slot name="empty" />
    </div>
  </div>
</template>
