<script setup lang="ts">
import { ref } from 'vue'
import ManualEntry from '../components/ManualEntry.vue'
import BulkEntry from '../components/BulkEntry.vue'
import OcrCapture from '../components/OcrCapture.vue'
import AppIcon from '@/ui/components/AppIcon.vue'

/** 录入优先级：OCR 扫描 → 手动（AI 补全）→ 批量粘贴 */
const tabs = [
  { key: 'ocr', label: '拍照 OCR', icon: 'camera' },
  { key: 'manual', label: '手动录入', icon: 'sparkle' },
  { key: 'bulk', label: '批量粘贴', icon: 'bulk' },
] as const

const active = ref<(typeof tabs)[number]['key']>('ocr')
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
        <AppIcon :name="tab.icon as never" :size="16" />
        {{ tab.label }}
      </button>
    </div>

    <!-- 不缓存 OCR 页：切换即释放摄像头与 Worker -->
    <OcrCapture v-if="active === 'ocr'" />
    <ManualEntry v-else-if="active === 'manual'" />
    <BulkEntry v-else />
  </div>
</template>

<style scoped>
.add {
  display: flex;
  flex-direction: column;
  gap: 16px;
  overflow: auto;
  padding-bottom: 20px;
}

.tabs {
  display: flex;
  gap: 0;
  border: 1px solid var(--line);
  border-radius: 2px;
  overflow: hidden;
}

.tab {
  flex: 1;
  min-height: 44px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  border: none;
  background: var(--paper);
  color: var(--ink-dim);
  font-size: 14px;
  border-right: 1px solid var(--line);
}

.tab:last-child {
  border-right: none;
}

.tab.is-active {
  background: var(--ink);
  color: #fff;
}
</style>
