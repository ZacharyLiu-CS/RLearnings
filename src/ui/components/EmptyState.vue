<script setup lang="ts">
import AppIcon from '@/ui/components/AppIcon.vue'

withDefaults(
  defineProps<{ title: string; description?: string; actionLabel?: string; icon?: string }>(),
  { description: '', actionLabel: '', icon: 'library' },
)

const emit = defineEmits<{ (e: 'action'): void }>()
</script>

<template>
  <div class="empty">
    <AppIcon :name="icon as never" :size="28" />
    <h3 class="empty-title">{{ title }}</h3>
    <p class="muted empty-desc">{{ description }}</p>
    <button v-if="actionLabel" class="btn btn-primary" type="button" @click="emit('action')">
      {{ actionLabel }}
    </button>
    <slot />
  </div>
</template>

<style scoped>
.empty {
  text-align: center;
  padding: 56px 20px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  color: var(--ink-faint);
}

.empty-title {
  margin: 8px 0 0;
  font-size: 16px;
  color: var(--ink);
}

.empty-desc {
  margin: 0 0 8px;
  font-size: 13px;
}
</style>
