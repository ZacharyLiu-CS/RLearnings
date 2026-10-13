<script setup lang="ts">
/**
 * 统一线性图标（瑞士风格：几何、单色、1.6 描边、无装饰）。
 * 全站不再使用 emoji，保证图标语言一致。
 */
import { computed } from 'vue'

const props = withDefaults(defineProps<{ name: IconName; size?: number }>(), { size: 18 })

type IconName =
  | 'library'
  | 'plus'
  | 'edit'
  | 'star'
  | 'trash'
  | 'chart'
  | 'settings'
  | 'camera'
  | 'bolt'
  | 'sparkle'
  | 'key'
  | 'search'
  | 'close'
  | 'check'
  | 'refresh'
  | 'bulk'

const PATHS: Record<IconName, string[]> = {
  library: ['M4 7l8-4 8 4-8 4-8-4z', 'M4 12l8 4 8-4', 'M4 17l8 4 8-4'],
  plus: ['M12 5v14', 'M5 12h14'],
  edit: ['M4 20h4L19 9l-4-4L4 16v4z', 'M14 6l4 4'],
  star: ['M12 4l2.4 5.2 5.6.6-4.2 3.8 1.2 5.6L12 16.4 6.9 19.2 8.1 13.6 4 9.8l5.6-.6L12 4z'],
  trash: ['M4 7h16', 'M9 7V4h6v3', 'M6 7l1 13h10l1-13'],
  chart: ['M5 20V12', 'M12 20V4', 'M19 20v-6', 'M3 20h18'],
  settings: ['M4 7h10', 'M18 7h2', 'M4 17h4', 'M12 17h8', 'M16 4v6', 'M8 14v6'],
  camera: ['M4 8h3l2-3h6l2 3h3v11H4z', 'M12 16a4 4 0 100-8 4 4 0 000 8z'],
  bolt: ['M13 3L5 14h6l-1 7 8-11h-6l1-7z'],
  sparkle: [
    'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3z',
    'M18 15l.8 2.2L21 18l-2.2.8L18 21l-.8-2.2L15 18l2.2-.8L18 15z',
  ],
  key: ['M15 8a3 3 0 100 6 3 3 0 000-6z', 'M12.6 12.6L4 21v-3h3v-3h3l2.6-2.4'],
  search: ['M11 19a8 8 0 100-16 8 8 0 000 16z', 'M17 17l4 4'],
  close: ['M6 6l12 12', 'M18 6L6 18'],
  check: ['M5 13l4 4L19 7'],
  refresh: ['M20 12a8 8 0 11-2.3-5.6', 'M20 4v4h-4'],
  bulk: ['M4 6h16', 'M4 12h16', 'M4 18h10'],
}

const paths = computed(() => PATHS[props.name] ?? [])
</script>

<template>
  <svg
    class="app-icon"
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.6"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <path v-for="(d, index) in paths" :key="index" :d="d" />
  </svg>
</template>

<style scoped>
.app-icon {
  display: block;
  flex: 0 0 auto;
}
</style>
