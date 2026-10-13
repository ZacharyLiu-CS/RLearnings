<script setup lang="ts">
import { nextTick, onBeforeUnmount, reactive, ref } from 'vue'
import { useWordsStore } from '../store'
import { usePlatformStore } from '@/core/stores/platform'
import { useAiStore } from '@/core/ai/settings'
import { enrichWord } from '@/core/ai/client'
import { disposeOcr, recognizeImage } from '../ocr/ocr.client'
import AppIcon from '@/ui/components/AppIcon.vue'

type Stage = 'idle' | 'camera' | 'ocr' | 'proofread'

const store = useWordsStore()
const platform = usePlatformStore()
const ai = useAiStore()
ai.load()

const stage = ref<Stage>('idle')
const aiEnriching = ref(false)
const error = ref('')
const progress = ref(0)
const progressText = ref('准备识别')
const videoRef = ref<HTMLVideoElement | null>(null)
const stageRef = ref<HTMLElement | null>(null)
const fileRef = ref<HTMLInputElement | null>(null)
interface DraftRow {
  ru: string
  zh: string
  pos?: string
  example?: string
  selected: boolean
  low: boolean
}

const drafts = ref<DraftRow[]>([])

let stream: MediaStream | null = null

/** 取景框使用相对比例坐标，适配任意屏幕尺寸 */
const frame = reactive({ x: 0.08, y: 0.32, w: 0.84, h: 0.2 })
let dragging = false
let grab = { dx: 0, dy: 0 }

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function stopCamera() {
  stream?.getTracks().forEach((track) => track.stop())
  stream = null
  if (videoRef.value) videoRef.value.srcObject = null
}

async function openCamera() {
  error.value = ''
  if (!window.isSecureContext) {
    error.value = '摄像头需要 HTTPS 或 localhost 环境，可改用「相册导入」或手动录入。'
    return
  }
  if (!navigator.mediaDevices?.getUserMedia) {
    error.value = '当前浏览器不支持摄像头，可改用「相册导入」或手动录入。'
    return
  }
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 } },
      audio: false,
    })
    stage.value = 'camera'
    await nextTick()
    if (videoRef.value) {
      videoRef.value.srcObject = stream
      await videoRef.value.play().catch(() => undefined)
    }
  } catch (err) {
    const name = err instanceof Error ? err.name : ''
    error.value =
      name === 'NotAllowedError'
        ? '摄像头权限被拒绝，可改用「相册导入」或手动录入。'
        : '摄像头打开失败，可改用「相册导入」或手动录入。'
  }
}

function startDrag(event: PointerEvent) {
  const rect = stageRef.value?.getBoundingClientRect()
  if (!rect) return
  dragging = true
  const px = (event.clientX - rect.left) / rect.width
  const py = (event.clientY - rect.top) / rect.height
  grab = { dx: px - frame.x, dy: py - frame.y }
  ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
}

function onDrag(event: PointerEvent, mode: 'move' | 'resize') {
  if (!dragging) return
  const rect = stageRef.value?.getBoundingClientRect()
  if (!rect) return
  const px = (event.clientX - rect.left) / rect.width
  const py = (event.clientY - rect.top) / rect.height
  if (mode === 'move') {
    frame.x = clamp(px - grab.dx, 0, 1 - frame.w)
    frame.y = clamp(py - grab.dy, 0, 1 - frame.h)
  } else {
    frame.w = clamp(px - frame.x, 0.15, 1 - frame.x)
    frame.h = clamp(py - frame.y, 0.08, 1 - frame.y)
  }
}

function endDrag() {
  dragging = false
}

async function capture() {
  const el = videoRef.value
  if (!el || !el.videoWidth) {
    error.value = '画面尚未就绪，请稍候再试。'
    return
  }
  const vw = el.videoWidth
  const vh = el.videoHeight
  const cw = el.clientWidth || 1
  const ch = el.clientHeight || 1
  const scale = Math.min(cw / vw, ch / vh)
  const offsetX = (cw - vw * scale) / 2
  const offsetY = (ch - vh * scale) / 2
  const sx = clamp((frame.x * cw - offsetX) / scale, 0, vw - 1)
  const sy = clamp((frame.y * ch - offsetY) / scale, 0, vh - 1)
  const sw = clamp((frame.w * cw) / scale, 8, vw - sx)
  const sh = clamp((frame.h * ch) / scale, 8, vh - sy)

  const bitmap = await createImageBitmap(el, sx, sy, sw, sh)
  stopCamera()
  await runOcr(bitmap)
}

async function onPickFile(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  error.value = ''
  try {
    const bitmap = await createImageBitmap(file)
    await runOcr(bitmap)
  } catch {
    error.value = '图片读取失败，请换一张图片或改用手动录入。'
  }
}

async function runOcr(bitmap: ImageBitmap) {
  stage.value = 'ocr'
  progress.value = 0
  progressText.value = '准备识别'
  try {
    const lines = await recognizeImage(bitmap, (p) => {
      progress.value = p.progress
      progressText.value = p.status
    })
    if (!lines.length) {
      error.value = '没有识别到文字，可调整取景框、换一张更清晰的图片，或改用手动录入。'
      stage.value = 'idle'
      return
    }
    // 低置信度行保留人工校对环节（ё/е、и/й 易混淆）
    drafts.value = lines.map((line) => ({
      ru: line.text,
      zh: '',
      selected: true,
      low: line.confidence < 70,
    }))
    stage.value = 'proofread'
  } catch (err) {
    error.value = `识别失败：${err instanceof Error ? err.message : String(err)}。可改用手动录入。`
    stage.value = 'idle'
  }
}

/** 对勾选行做 AI 补全：只给原文，模型补释义 / 词性 / 例句 */
async function onAiEnrich() {
  const targets = drafts.value.filter((draft) => draft.selected && draft.ru.trim())
  if (!targets.length) {
    platform.pushToast('请先勾选要补全的行', 'warn')
    return
  }
  if (!ai.configured) {
    platform.pushToast('未配置 API Key，请先在「AI」页填写', 'warn')
    return
  }
  aiEnriching.value = true
  try {
    for (const draft of targets) {
      const result = await enrichWord(ai.config, draft.ru)
      draft.ru = result.ru || draft.ru
      draft.zh = result.zh ?? draft.zh
      draft.pos = result.pos
      draft.example = result.example
    }
    platform.pushToast(`已补全 ${targets.length} 行`, 'success')
  } catch (err) {
    platform.pushToast(err instanceof Error ? err.message : 'AI 补全失败', 'error')
  } finally {
    aiEnriching.value = false
  }
}

async function submit() {
  const selected = drafts.value.filter((draft) => draft.selected && draft.ru.trim())
  if (!selected.length) {
    platform.pushToast('请至少勾选一条', 'warn')
    return
  }
  await store.addItems(
    selected.map((draft) => ({
      ru: draft.ru.trim(),
      zh: draft.zh.trim() || undefined,
      pos: draft.pos,
      example: draft.example,
      tags: ['OCR'],
    })),
    'ocr',
  )
  drafts.value = []
  stage.value = 'idle'
}

onBeforeUnmount(() => {
  stopCamera()
  disposeOcr()
})
</script>

<template>
  <div>
    <div v-if="error" class="card warn-bar">{{ error }}</div>

    <!-- 入口 -->
    <div v-if="stage === 'idle'" class="card">
      <div class="row" style="flex-wrap: wrap; gap: 10px">
        <button class="btn btn-primary" type="button" @click="openCamera">
          <AppIcon name="camera" :size="16" />
          打开摄像头拍照
        </button>
        <button class="btn" type="button" @click="fileRef?.click()">
          <AppIcon name="library" :size="16" />
          从相册导入
        </button>
      </div>
      <p class="muted" style="font-size: 13px; margin: 12px 0 0">
        建议拍摄印刷体俄语，取景框对准一行或多行单词；识别在后台线程执行，界面不会卡顿。
        识别结果会先进入校对列表，确认无误后再入库。
      </p>
      <input ref="fileRef" type="file" accept="image/*" hidden @change="onPickFile" />
    </div>

    <!-- 识别中 -->
    <div v-else-if="stage === 'ocr'" class="card">
      <div class="row" style="justify-content: space-between">
        <strong>{{ progressText }}</strong>
        <span class="faint">{{ Math.round(progress * 100) }}%</span>
      </div>
      <div class="progress"><div class="progress-bar" :style="{ width: `${Math.round(progress * 100)}%` }" /></div>
    </div>

    <!-- 校对 -->
    <div v-else-if="stage === 'proofread'" class="card">
      <div class="row" style="margin-bottom: 10px">
        <strong>校对识别结果</strong>
        <span class="faint" style="font-size: 12px">标黄行置信度较低，请重点确认 ё/е、и/й</span>
        <div class="spacer" />
        <span class="faint" style="font-size: 12px">
          已选 {{ drafts.filter((d) => d.selected).length }} / {{ drafts.length }}
        </span>
      </div>

      <div class="draft-list">
        <div v-for="(draft, index) in drafts" :key="index" :class="['draft-row', draft.low && 'is-low']">
          <input v-model="draft.selected" type="checkbox" />
          <input v-model="draft.ru" class="input" placeholder="俄语" />
          <input v-model="draft.zh" class="input" placeholder="释义（可选）" />
        </div>
      </div>

      <div class="row" style="margin-top: 14px">
        <button class="btn btn-ghost" type="button" @click="drafts = []; stage = 'idle'">放弃</button>
        <button class="btn" type="button" :disabled="aiEnriching" @click="onAiEnrich">
          <AppIcon name="sparkle" :size="16" />
          {{ aiEnriching ? '补全中…' : 'AI 补全选中项' }}
        </button>
        <div class="spacer" />
        <button class="btn btn-primary" type="button" @click="submit">批量入库</button>
      </div>
    </div>

    <!-- 取景 -->
    <div v-else class="viewfinder">
      <div ref="stageRef" class="stage">
        <video ref="videoRef" class="video" playsinline muted autoplay />
        <div
          class="crop"
          :style="{
            left: `${frame.x * 100}%`,
            top: `${frame.y * 100}%`,
            width: `${frame.w * 100}%`,
            height: `${frame.h * 100}%`,
          }"
          @pointerdown="startDrag($event)"
          @pointermove="onDrag($event, 'move')"
          @pointerup="endDrag"
          @pointercancel="endDrag"
        >
          <span
            class="handle"
            @pointerdown.stop="startDrag($event)"
            @pointermove.stop="onDrag($event, 'resize')"
            @pointerup.stop="endDrag"
          />
        </div>
      </div>
      <div class="row controls">
        <button class="btn btn-ghost" type="button" @click="stopCamera(); stage = 'idle'">取消</button>
        <button class="btn btn-primary shot" type="button" @click="capture">拍照识别</button>
      </div>
      <p class="faint" style="text-align: center; font-size: 12px">拖动筛选框可移动，拖动右下角可缩放</p>
    </div>
  </div>
</template>

<style scoped>
.warn-bar {
  margin-bottom: 12px;
  border-color: rgba(255, 176, 32, 0.4);
  color: var(--warn);
  font-size: 13px;
}

.progress {
  margin-top: 10px;
  height: 6px;
  border-radius: 999px;
  background: var(--bg-soft);
  overflow: hidden;
}

.progress-bar {
  height: 100%;
  background: var(--accent);
  transition: width 0.18s ease;
}

.draft-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 46vh;
  overflow: auto;
}

.draft-row {
  display: grid;
  grid-template-columns: 24px 1fr 1fr;
  gap: 8px;
  align-items: center;
}

.draft-row.is-low .input {
  border-color: rgba(255, 176, 32, 0.55);
  background: rgba(255, 176, 32, 0.08);
}

.viewfinder {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.stage {
  position: relative;
  height: min(58vh, 460px);
  border-radius: var(--radius);
  overflow: hidden;
  background: #000;
}

.video {
  width: 100%;
  height: 100%;
  object-fit: contain;
  display: block;
}

.crop {
  position: absolute;
  border: 2px solid var(--accent);
  border-radius: 6px;
  box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.55);
  touch-action: none;
  cursor: move;
}

.handle {
  position: absolute;
  right: -10px;
  bottom: -10px;
  width: 26px;
  height: 26px;
  border-radius: 50%;
  background: var(--accent);
  border: 2px solid #fff;
  cursor: nwse-resize;
}

.controls {
  justify-content: center;
  gap: 14px;
}

.shot {
  min-width: 140px;
}
</style>
