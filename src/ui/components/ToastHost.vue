<script setup lang="ts">
import { usePlatformStore } from '@/core/stores/platform'

const platform = usePlatformStore()
</script>

<template>
  <div class="toast-host">
    <div
      v-for="toast in platform.toasts"
      :key="toast.id"
      :class="['toast', `toast-${toast.tone}`]"
      role="status"
    >
      {{ toast.message }}
    </div>
  </div>
</template>
