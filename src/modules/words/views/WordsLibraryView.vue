<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useWordsStore } from '../store'
import type { ItemQuery } from '@/core/db/repository'
import type { LearningItem } from '@/core/types'
import VirtualList from '@/ui/components/VirtualList.vue'
import SkeletonRows from '@/ui/components/SkeletonRows.vue'
import EmptyState from '@/ui/components/EmptyState.vue'
import WordRow from '../components/WordRow.vue'
import ItemEditorDialog from '../components/ItemEditorDialog.vue'

const store = useWordsStore()
const router = useRouter()
const editing = ref<LearningItem | null>(null)
const keyword = ref('')
let timer = 0

const STATUS_OPTIONS: Array<{ label: string; value: NonNullable<ItemQuery['status']> }> = [
  { label: '全部状态', value: 'all' },
  { label: '新学', value: 'new' },
  { label: '学习中', value: 'learning' },
  { label: '复习中', value: 'reviewing' },
  { label: '已掌握', value: 'mastered' },
]

const TYPE_OPTIONS: Array<{ label: string; value: NonNullable<ItemQuery['type']> }> = [
  { label: '全部类型', value: 'all' },
  { label: '单词', value: 'word' },
  { label: '句子', value: 'sentence' },
]

function onKeywordInput() {
  window.clearTimeout(timer)
  timer = window.setTimeout(() => {
    store.setQuery({ keyword: keyword.value })
    void store.refresh()
  }, 200)
}

watch(
  () => [store.query.status, store.query.type, store.query.starredOnly],
  () => void store.refresh(),
)

onMounted(() => void store.refresh())
onBeforeUnmount(() => window.clearTimeout(timer))

function confirmRemove(item: LearningItem) {
  if (window.confirm(`删除「${item.ru}」？`)) void store.removeItem(item.id)
}

function saveEdit(patch: Partial<LearningItem>) {
  if (editing.value) void store.updateItem(editing.value.id, patch)
  editing.value = null
}
</script>

<template>
  <div class="library">
    <div class="toolbar">
      <input
        v-model="keyword"
        class="input"
        style="max-width: 260px"
        placeholder="搜索俄语 / 释义 / 标签"
        @input="onKeywordInput"
      />
      <select v-model="store.query.status" class="select" style="max-width: 130px">
        <option v-for="opt in STATUS_OPTIONS" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
      </select>
      <select v-model="store.query.type" class="select" style="max-width: 120px">
        <option v-for="opt in TYPE_OPTIONS" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
      </select>
      <button
        :class="['chip', store.query.starredOnly && 'is-active']"
        type="button"
        @click="store.setQuery({ starredOnly: !store.query.starredOnly }); store.refresh()"
      >
        ★ 只看收藏
      </button>
      <div class="spacer" />
      <span class="faint">共 {{ store.total }} 条</span>
      <button class="btn btn-primary" type="button" @click="router.push({ name: 'words-add' })">
        + 录入
      </button>
    </div>

    <SkeletonRows v-if="store.loading && !store.items.length" :rows="8" :height="64" />

    <VirtualList v-else :items="store.items" :item-height="72">
      <template #default="{ item }">
        <WordRow
          :item="item"
          @star="store.toggleStar(item)"
          @edit="editing = item"
          @remove="confirmRemove(item)"
        />
      </template>
      <template #empty>
        <EmptyState
          title="词库还是空的"
          description="可以手动录入、批量粘贴，或用摄像头拍照识别。"
          action-label="去录入"
          @action="router.push({ name: 'words-add' })"
        />
      </template>
    </VirtualList>

    <ItemEditorDialog :item="editing" @save="saveEdit" @close="editing = null" />
  </div>
</template>

<style scoped>
.library {
  display: flex;
  flex-direction: column;
  min-height: 0;
  flex: 1;
  gap: 12px;
}

.toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
</style>
