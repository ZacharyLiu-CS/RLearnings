<script setup lang="ts">
withDefaults(defineProps<{ rows?: number; height?: number }>(), { rows: 6, height: 64 })
</script>

<template>
  <div style="display: flex; flex-direction: column; gap: 10px; padding: 8px 0">
    <div
      v-for="i in rows"
      :key="i"
      class="skeleton"
      :style="{ height: `${height}px` }"
      aria-hidden="true"
    />
  </div>
</template>
