<script setup lang="ts">
/**
 * AI 配置界面：目前仅支持 DeepSeek（OpenAI 兼容协议）。
 * 配置只保存在本机，不会随学习数据上传。
 */
import { computed, onMounted, ref } from 'vue'
import { useAiStore } from '@/core/ai/settings'
import { testConnection } from '@/core/ai/client'
import { usePlatformStore } from '@/core/stores/platform'
import { AI_PROVIDERS, DEFAULT_AI_CONFIG, MODEL_PRESETS } from '../../../../shared/ai'
import AppIcon from '@/ui/components/AppIcon.vue'

const ai = useAiStore()
const platform = usePlatformStore()

const form = ref({ ...DEFAULT_AI_CONFIG })
const showKey = ref(false)
const customModel = ref(false)
const saved = ref(false)

const isPresetModel = computed(() => MODEL_PRESETS.some((preset) => preset.id === form.value.model))

onMounted(() => {
  ai.load()
  form.value = { ...ai.config }
  customModel.value = !isPresetModel.value && Boolean(form.value.model)
})

function onModelSelect(value: string) {
  if (value === '__custom__') {
    customModel.value = true
    form.value.model = ''
    return
  }
  customModel.value = false
  form.value.model = value
}

async function onTest() {
  if (!form.value.apiKey.trim()) {
    platform.pushToast('请先填写 API Key', 'warn')
    return
  }
  ai.setTesting(true)
  ai.setTestResult(null)
  try {
    const message = await testConnection({ ...form.value })
    ai.setTestResult({ ok: true, message })
    platform.pushToast('连接正常', 'success')
  } catch (err) {
    const message = err instanceof Error ? err.message : '连接失败'
    ai.setTestResult({ ok: false, message })
    platform.pushToast(message, 'error')
  } finally {
    ai.setTesting(false)
  }
}

function onSave() {
  ai.save({ ...form.value })
  saved.value = true
  platform.pushToast('配置已保存到本机', 'success')
}

function onReset() {
  ai.reset()
  form.value = { ...DEFAULT_AI_CONFIG }
  customModel.value = false
  saved.value = false
  platform.pushToast('已清除配置', 'warn')
}
</script>

<template>
  <div class="settings">
    <div class="card">
      <div class="row" style="margin-bottom: 4px">
        <AppIcon name="key" :size="18" />
        <h2 style="margin: 0; font-size: 16px">模型服务</h2>
      </div>
      <p class="muted" style="font-size: 13px; margin: 6px 0 20px">
        填写 Key 后，录入只需给出俄语单词，释义 / 词性 / 重音 / 变位 / 例句 / 标签由模型自动生成。
      </p>

      <div class="field" style="margin-bottom: 16px">
        <label class="micro">服务商</label>
        <div class="row provider-row">
          <span
            v-for="provider in AI_PROVIDERS"
            :key="provider.id"
            class="chip is-active"
          >{{ provider.label }}</span>
          <span class="faint" style="font-size: 12px">后续版本将支持更多服务商</span>
        </div>
      </div>

      <div class="field" style="margin-bottom: 16px">
        <label class="micro" for="ai-key">API Key</label>
        <div class="row">
          <input
            id="ai-key"
            v-model="form.apiKey"
            class="input"
            :type="showKey ? 'text' : 'password'"
            placeholder="sk-..."
            autocomplete="off"
          />
          <button class="btn btn-ghost" type="button" @click="showKey = !showKey">
            {{ showKey ? '隐藏' : '显示' }}
          </button>
        </div>
      </div>

      <div class="field" style="margin-bottom: 16px">
        <label class="micro" for="ai-base">接口地址</label>
        <input id="ai-base" v-model="form.baseUrl" class="input" placeholder="https://api.deepseek.com" />
      </div>

      <div class="field" style="margin-bottom: 16px">
        <label class="micro" for="ai-model">模型</label>
        <select
          id="ai-model"
          class="select"
          :value="customModel ? '__custom__' : form.model"
          @change="onModelSelect(($event.target as HTMLSelectElement).value)"
        >
          <option v-for="preset in MODEL_PRESETS" :key="preset.id" :value="preset.id">
            {{ preset.label }}
          </option>
          <option value="__custom__">自定义模型名…</option>
        </select>
        <input
          v-if="customModel"
          v-model="form.model"
          class="input"
          style="margin-top: 8px"
          placeholder="输入模型 ID，如 deepseek-flash"
        />
      </div>

      <div v-if="ai.testResult" :class="['notice', ai.testResult.ok ? 'notice-ok' : 'notice-bad']">
        {{ ai.testResult.message }}
      </div>

      <div class="row" style="margin-top: 20px">
        <button class="btn" type="button" :disabled="ai.testing" @click="onTest">
          {{ ai.testing ? '测试中…' : '测试连接' }}
        </button>
        <button class="btn btn-primary" type="button" @click="onSave">保存配置</button>
        <div class="spacer" />
        <button class="btn btn-ghost" type="button" @click="onReset">清除</button>
      </div>

      <p class="faint" style="font-size: 12px; margin: 16px 0 0">
        Key 仅保存在本机浏览器（localStorage），不会写入学习数据备份，也不会上传到任何服务端。
        <span v-if="saved"> · 当前生效模型：{{ form.model || '未设置' }}</span>
      </p>
    </div>
  </div>
</template>

<style scoped>
.settings {
  max-width: 560px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  overflow: auto;
  padding-bottom: 20px;
}

.provider-row {
  flex-wrap: wrap;
}

.notice-ok {
  border-left-color: #0f6b4f;
}

.notice-bad {
  border-left-color: var(--accent);
}
</style>
