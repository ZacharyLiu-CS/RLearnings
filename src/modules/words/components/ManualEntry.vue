<script setup lang="ts">
/**
 * 手动录入（AI 优先）：用户只输入俄语单词，
 * 释义 / 词性 / 重音 / 变位 / 例句 / 标签全部由模型生成，确认后入库。
 */
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useWordsStore } from '../store'
import { useAiStore } from '@/core/ai/settings'
import { enrichWord } from '@/core/ai/client'
import { usePlatformStore } from '@/core/stores/platform'
import type { WordDraft } from '../../../../shared/ai'
import AppIcon from '@/ui/components/AppIcon.vue'

const store = useWordsStore()
const ai = useAiStore()
const platform = usePlatformStore()
const router = useRouter()

const raw = ref('')
const drafts = ref<WordDraft[]>([])
const busy = ref(false)
const errorMsg = ref('')

const words = computed(() =>
  raw.value
    .split(/[\n,，;；]+/)
    .map((token) => token.trim())
    .filter(Boolean),
)

onMounted(() => ai.load())

/** 限并发的顺序映射，避免一次发太多请求被限流 */
async function mapLimit<T, R>(list: T[], limit: number, worker: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(list.length)
  let cursor = 0
  async function runner(): Promise<void> {
    while (cursor < list.length) {
      const index = cursor
      cursor += 1
      results[index] = await worker(list[index])
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, list.length) }, runner))
  return results
}

async function onEnrich() {
  if (!words.value.length) {
    platform.pushToast('请先输入俄语单词', 'warn')
    return
  }
  if (!ai.configured) {
    errorMsg.value = '尚未配置 API Key，请先在「AI」页填入 DeepSeek 的 Key。'
    return
  }
  busy.value = true
  errorMsg.value = ''
  try {
    const results = await mapLimit(words.value, 3, (ru) => enrichWord(ai.config, ru))
    drafts.value = [...results, ...drafts.value]
    raw.value = ''
    platform.pushToast(`已补全 ${results.length} 条`, 'success')
  } catch (err) {
    errorMsg.value = err instanceof Error ? err.message : 'AI 补全失败'
  } finally {
    busy.value = false
  }
}

/** 离线兜底：只存原文，等有网时再补全 */
async function onSavePlain() {
  if (!words.value.length) return
  await store.addItems(words.value.map((ru) => ({ ru })), 'manual')
  raw.value = ''
}

function removeDraft(index: number) {
  drafts.value.splice(index, 1)
}

async function onSaveDrafts() {
  if (!drafts.value.length) return
  await store.addItems(
    drafts.value.map((draft) => ({
      ru: draft.ru,
      zh: draft.zh,
      pos: draft.pos,
      stress: draft.stress,
      forms: draft.forms,
      example: draft.example,
      note: draft.note,
      tags: draft.tags,
    })),
    'manual',
  )
  drafts.value = []
}

function goSettings() {
  void router.push({ name: 'words-settings' })
}
</script>

<template>
  <div class="entry">
    <div class="card">
      <div class="row head">
        <AppIcon name="sparkle" :size="18" />
        <h3 class="head-title">AI 补全录入</h3>
        <span class="badge">{{ ai.configured ? ai.modelLabel : '未配置' }}</span>
      </div>
      <p class="muted hint">
        只输入俄语单词即可（多个单词用换行或逗号分隔），释义、词性、重音、变位、例句与标签由模型自动生成。
      </p>

      <textarea
        v-model="raw"
        class="textarea"
        style="min-height: 96px"
        placeholder="дом&#10;изучать, книга"
      />

      <div v-if="!ai.configured" class="notice notice-bad">
        尚未配置 API Key。
        <button class="link-btn" type="button" @click="goSettings">前往 AI 设置</button>
      </div>
      <div v-else-if="errorMsg" class="notice notice-bad">{{ errorMsg }}</div>

      <div class="row actions">
        <span class="faint micro">{{ words.length }} word(s)</span>
        <div class="spacer" />
        <button class="btn btn-ghost" type="button" :disabled="!words.length" @click="onSavePlain">
          仅存原文
        </button>
        <button class="btn btn-primary" type="button" :disabled="busy || !words.length" @click="onEnrich">
          <AppIcon name="sparkle" :size="16" />
          {{ busy ? '补全中…' : 'AI 补全' }}
        </button>
      </div>
    </div>

    <div v-if="drafts.length" class="card">
      <div class="row" style="margin-bottom: 12px">
        <h3 class="head-title">待入库（{{ drafts.length }}）</h3>
        <div class="spacer" />
        <button class="btn btn-primary" type="button" @click="onSaveDrafts">全部入库</button>
      </div>

      <div v-for="(draft, index) in drafts" :key="index" class="draft">
        <div class="row draft-head">
          <span class="badge">{{ draft.pos || '—' }}</span>
          <input v-model="draft.ru" class="input draft-ru" />
          <input v-model="draft.zh" class="input" placeholder="释义" />
          <button class="btn btn-ghost icon-only" type="button" @click="removeDraft(index)">
            <AppIcon name="close" :size="16" />
          </button>
        </div>
        <div class="draft-meta faint">
          <span v-if="draft.stress">重音 {{ draft.stress }}</span>
          <span v-if="draft.forms">· {{ draft.forms }}</span>
        </div>
        <div v-if="draft.example" class="draft-example">{{ draft.example }}</div>
        <div class="row tags">
          <span v-for="tag in draft.tags" :key="tag" class="badge">{{ tag }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.entry {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.head-title {
  margin: 0;
  font-size: 16px;
}

.hint {
  font-size: 13px;
  margin: 6px 0 14px;
}

.actions {
  margin-top: 14px;
}

.notice-bad {
  margin-top: 14px;
}

.link-btn {
  border: none;
  background: none;
  padding: 0 2px;
  color: var(--accent);
  text-decoration: underline;
  font-size: inherit;
}

.draft {
  border-top: 1px solid var(--line);
  padding: 14px 0;
}

.draft-head {
  gap: 8px;
}

.draft-ru {
  font-family: var(--font-ru);
  max-width: 220px;
}

.draft-meta {
  font-size: 12px;
  margin-top: 6px;
}

.draft-example {
  font-style: italic;
  font-size: 13px;
  margin-top: 4px;
}

.tags {
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 8px;
}

.icon-only {
  min-height: 36px;
  padding: 0 10px;
}
</style>
