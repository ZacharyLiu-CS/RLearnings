<script setup lang="ts">
/**
 * 模块级错误边界：单模块崩溃不影响外壳与其他模块，并提供「重载模块」。
 */
import { onErrorCaptured, ref } from 'vue'

const error = ref<Error | null>(null)
const reloadKey = ref(0)

onErrorCaptured((err) => {
  error.value = err instanceof Error ? err : new Error(String(err))
  return false
})

function reload() {
  error.value = null
  reloadKey.value += 1
}
</script>

<template>
  <div v-if="error" class="card" style="margin: auto; max-width: 460px">
    <h3 style="margin: 0 0 8px">模块加载异常</h3>
    <p class="muted" style="margin: 0 0 14px; font-size: 13px">
      {{ error.message || '未知错误' }}——已隔离该模块，其他功能仍可正常使用。
    </p>
    <button class="btn btn-primary" type="button" @click="reload">重载模块</button>
  </div>
  <div v-else :key="reloadKey" style="display: contents">
    <slot />
  </div>
</template>
