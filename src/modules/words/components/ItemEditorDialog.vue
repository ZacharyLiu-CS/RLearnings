<script setup lang="ts">
import { reactive, watch } from 'vue'
import type { LearningItem } from '@/core/types'

const props = defineProps<{ item: LearningItem | null }>()
const emit = defineEmits<{ (e: 'save', patch: Partial<LearningItem>): void; (e: 'close'): void }>()

const form = reactive({
  ru: '',
  stress: '',
  pos: '',
  zh: '',
  forms: '',
  example: '',
  note: '',
  tags: '',
})

watch(
  () => props.item,
  (item) => {
    if (!item) return
    form.ru = item.ru
    form.stress = item.stress ?? ''
    form.pos = item.pos ?? ''
    form.zh = item.zh ?? ''
    form.forms = item.forms ?? ''
    form.example = item.example ?? ''
    form.note = item.note ?? ''
    form.tags = item.tags.join(', ')
  },
  { immediate: true },
)

function submit() {
  emit('save', {
    ru: form.ru.trim(),
    stress: form.stress.trim() || undefined,
    pos: form.pos.trim() || undefined,
    zh: form.zh.trim() || undefined,
    forms: form.forms.trim() || undefined,
    example: form.example.trim() || undefined,
    note: form.note.trim() || undefined,
    tags: form.tags
      .split(/[,，]/)
      .map((tag) => tag.trim())
      .filter(Boolean),
  })
}
</script>

<template>
  <div v-if="props.item" class="mask" @click.self="emit('close')">
    <div class="card dialog" role="dialog" aria-modal="true">
      <h3 style="margin: 0 0 14px; font-size: 16px">编辑词条</h3>
      <div class="grid">
        <div class="field">
          <label>俄语 *</label>
          <input v-model="form.ru" class="input" />
        </div>
        <div class="field">
          <label>释义</label>
          <input v-model="form.zh" class="input" />
        </div>
        <div class="field">
          <label>重音</label>
          <input v-model="form.stress" class="input" placeholder="如 до́м" />
        </div>
        <div class="field">
          <label>词性</label>
          <input v-model="form.pos" class="input" placeholder="noun / verb / adj" />
        </div>
        <div class="field" style="grid-column: 1 / -1">
          <label>变位 / 复数</label>
          <input v-model="form.forms" class="input" />
        </div>
        <div class="field" style="grid-column: 1 / -1">
          <label>例句</label>
          <textarea v-model="form.example" class="textarea" style="min-height: 72px" />
        </div>
        <div class="field" style="grid-column: 1 / -1">
          <label>标签（逗号分隔）</label>
          <input v-model="form.tags" class="input" />
        </div>
      </div>
      <div class="row" style="justify-content: flex-end; margin-top: 16px">
        <button class="btn btn-ghost" type="button" @click="emit('close')">取消</button>
        <button class="btn btn-primary" type="button" @click="submit">保存</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.mask {
  position: fixed;
  inset: 0;
  background: rgba(6, 8, 12, 0.6);
  display: grid;
  place-items: center;
  padding: 20px;
  z-index: 50;
}

.dialog {
  width: min(560px, 100%);
  max-height: 86vh;
  overflow: auto;
}

.grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

@media (max-width: 560px) {
  .grid {
    grid-template-columns: 1fr;
  }
}
</style>
