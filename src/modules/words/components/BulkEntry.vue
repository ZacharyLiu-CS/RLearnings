<script setup lang="ts">
import { computed, ref } from 'vue'
import { useWordsStore, type ItemDraft } from '../store'
import { usePlatformStore } from '@/core/stores/platform'

const store = useWordsStore()
const platform = usePlatformStore()
const raw = ref('')

const SAMPLE = `дом - 房子
книга = 书
говорить\t说
учебник, 课本`

/** 支持 `ru - zh` / `ru = zh` / `ru, zh` / `ru<Tab>zh` 四种分隔 */
const parsed = computed<ItemDraft[]>(() =>
  raw.value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const match = line.split(/\s*(?:-{1,2}|=|,|，|\t)\s*/)
      const [ru, ...rest] = match
      return { ru: ru?.trim() ?? '', zh: rest.join(' ').trim() || undefined }
    })
    .filter((draft) => draft.ru),
)

async function submit() {
  if (!parsed.value.length) {
    platform.pushToast('没有可导入的内容', 'warn')
    return
  }
  const { added } = await store.addItems(parsed.value, 'manual')
  if (added) raw.value = ''
}
</script>

<template>
  <div class="card">
    <div class="field">
      <label>批量粘贴（每行一条，支持 - / = / , / Tab 分隔释义）</label>
      <textarea
        v-model="raw"
        class="textarea"
        style="min-height: 200px; font-family: inherit"
        :placeholder="SAMPLE"
      />
    </div>

    <div class="row" style="margin-top: 12px">
      <span class="muted" style="font-size: 13px">已解析 {{ parsed.length }} 条</span>
      <div class="spacer" />
      <button class="btn btn-ghost" type="button" @click="raw = SAMPLE">填入示例</button>
      <button class="btn btn-primary" type="button" :disabled="!parsed.length" @click="submit">
        批量入库
      </button>
    </div>

    <div v-if="parsed.length" class="preview">
      <div v-for="(draft, index) in parsed.slice(0, 8)" :key="index" class="preview-row">
        <span class="title-ru" style="font-size: 16px">{{ draft.ru }}</span>
        <span class="muted">{{ draft.zh || '—' }}</span>
      </div>
      <div v-if="parsed.length > 8" class="faint" style="font-size: 12px">
        … 还有 {{ parsed.length - 8 }} 条
      </div>
    </div>
  </div>
</template>

<style scoped>
.preview {
  margin-top: 14px;
  border-top: 1px solid var(--border);
  padding-top: 12px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.preview-row {
  display: flex;
  gap: 12px;
  align-items: baseline;
  font-size: 14px;
}
</style>
