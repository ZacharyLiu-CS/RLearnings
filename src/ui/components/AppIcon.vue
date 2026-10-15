<script setup lang="ts">
/**
 * 统一线性图标（瑞士风格：几何、单色、1.6 描边、无装饰）。
 * 路径数据在 shared/ui-icons.json（与图标生成脚本共用同一份来源）。
 */
import { computed } from 'vue'
import ICON_PATHS from '../../../shared/ui-icons.json'

type IconName = keyof typeof ICON_PATHS

const props = withDefaults(defineProps<{ name: string; size?: number }>(), { size: 18 })

const paths = computed<string[]>(() => ICON_PATHS[props.name as IconName] ?? [])
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
