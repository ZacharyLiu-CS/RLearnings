<script setup lang="ts">
withDefaults(
  defineProps<{ title: string; description?: string; actionLabel?: string }>(),
  { description: '', actionLabel: '' },
)

const emit = defineEmits<{ (e: 'action'): void }>()
</script>

<template>
  <div style="text-align: center; padding: 48px 20px">
    <div style="font-size: 34px; opacity: 0.6">📚</div>
    <h3 style="margin: 10px 0 6px; font-size: 16px">{{ title }}</h3>
    <p class="muted" style="margin: 0 0 16px; font-size: 13px">{{ description }}</p>
    <button v-if="actionLabel" class="btn btn-primary" type="button" @click="emit('action')">
      {{ actionLabel }}
    </button>
    <slot />
  </div>
</template>
