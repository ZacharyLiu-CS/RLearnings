<script setup lang="ts">
import { ref } from 'vue'
import ManualEntry from '../components/ManualEntry.vue'
import BulkEntry from '../components/BulkEntry.vue'
import OcrCapture from '../components/OcrCapture.vue'

const tabs = [
  { key: 'manual', label: '✍️ 手动录入' },
  { key: 'bulk', label: '📋 批量粘贴' },
  { key: 'ocr', label: '📷 拍照 OCR' },
] as const

const active = ref<(typeof tabs)[number]['key']>('manual')
</script>

<template>
  <div class="add">
    <div class="tabs">
      <button
        v-for="tab in tabs"
        :key="tab.key"
        :class="['tab', active === tab.key && 'is-active']"
        type="button"
        @click="active = tab.key"
      >
        {{ tab.label }}
      </button>
    </div>

    <!-- 不缓存 OCR 页：切换即释放摄像头与 Worker -->
    <ManualEntry v-if="active === 'manual'" />
    <BulkEntry v-else-if="active === 'bulk'" />
    <OcrCapture v-else />
  </div>
</template>

<style scoped>
.add {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.tabs {
  display: flex;
  gap: 6px;
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 6px;
}

.tab {
  flex: 1;
  min-height: 40px;
  border-radius: var(--radius-sm);
  border: none;
  background: transparent;
  color: var(--text-dim);
}

.tab.is-active {
  background: var(--accent-soft);
  color: #cfe0ff;
}
</style>
