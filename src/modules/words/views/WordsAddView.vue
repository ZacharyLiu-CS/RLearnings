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

/* iOS 分段控件：灰轨 + 白色滑块态，弹簧按压 */
.tabs {
  display: flex;
  gap: 2px;
  padding: 3px;
  border: none;
  border-radius: 12px;
  background: var(--paper-soft);
}

.tab {
  flex: 1;
  min-height: 38px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  border: none;
  border-radius: 9px;
  background: transparent;
  color: var(--ink-dim);
  font-size: 14px;
  transition:
    background var(--dur-2) var(--ease-out),
    color var(--dur-2) var(--ease-out),
    box-shadow var(--dur-2) var(--ease-out),
    transform var(--dur-1) var(--spring);
}

.tab:active {
  transform: scale(0.96);
}

.tab.is-active {
  background: var(--paper);
  color: var(--ink);
  font-weight: 600;
  box-shadow:
    0 0.5px 1px rgba(17, 17, 17, 0.08),
    0 2px 8px rgba(17, 17, 17, 0.08);
}
</style>
