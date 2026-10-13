<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useWordsStore, type ItemDraft } from '../store'
import { usePlatformStore } from '@/core/stores/platform'

const store = useWordsStore()
const platform = usePlatformStore()
const ruRef = ref<HTMLInputElement | null>(null)

const form = reactive({
  ru: '',
  zh: '',
  pos: '',
  stress: '',
  forms: '',
  example: '',
  note: '',
  tags: '',
})

function reset() {
  Object.assign(form, {
    ru: '',
    zh: '',
    pos: '',
    stress: '',
    forms: '',
    example: '',
    note: '',
    tags: '',
  })
  ruRef.value?.focus()
}

function toDraft(): ItemDraft {
  return {
    ru: form.ru.trim(),
    zh: form.zh.trim() || undefined,
    pos: form.pos.trim() || undefined,
    stress: form.stress.trim() || undefined,
    forms: form.forms.trim() || undefined,
    example: form.example.trim() || undefined,
    note: form.note.trim() || undefined,
    tags: form.tags
      .split(/[,，]/)
      .map((tag) => tag.trim())
      .filter(Boolean),
  }
}

async function save(keepGoing: boolean) {
  if (!form.ru.trim()) {
    platform.pushToast('请先填写俄语原文', 'warn')
    return
  }
  const { added } = await store.addItems([toDraft()], 'manual')
  if (added && keepGoing) reset()
  else if (added) reset()
}
</script>

<template>
  <div class="card">
    <div class="grid">
      <div class="field">
        <label>俄语原文 *</label>
        <input ref="ruRef" v-model="form.ru" class="input" placeholder="например: дом" />
      </div>
      <div class="field">
        <label>中文释义</label>
        <input v-model="form.zh" class="input" placeholder="房子" />
      </div>
      <div class="field">
        <label>词性</label>
        <input v-model="form.pos" class="input" placeholder="noun / verb / adj / adv" />
      </div>
      <div class="field">
        <label>重音标注</label>
        <input v-model="form.stress" class="input" placeholder="до́м" />
      </div>
      <div class="field" style="grid-column: 1 / -1">
        <label>变位 / 复数形式</label>
        <input v-model="form.forms" class="input" placeholder="дома, дому, дом, домом, о доме" />
      </div>
      <div class="field" style="grid-column: 1 / -1">
        <label>例句</label>
        <textarea v-model="form.example" class="textarea" style="min-height: 80px" />
      </div>
      <div class="field">
        <label>标签（逗号分隔）</label>
        <input v-model="form.tags" class="input" placeholder="名词, 高频" />
      </div>
      <div class="field">
        <label>备注</label>
        <input v-model="form.note" class="input" />
      </div>
    </div>

    <div class="row" style="margin-top: 16px">
      <button class="btn btn-primary" type="button" @click="save(true)">保存并继续</button>
      <button class="btn" type="button" @click="save(false)">保存</button>
      <button class="btn btn-ghost" type="button" @click="reset">清空</button>
      <span class="faint" style="font-size: 12px">Ctrl / ⌘ + Enter 快速保存</span>
    </div>
  </div>
</template>

<style scoped>
.grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

@media (max-width: 620px) {
  .grid {
    grid-template-columns: 1fr;
  }
}
</style>
