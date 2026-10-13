<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink, RouterView, useRoute } from 'vue-router'
import { usePlatformStore } from '@/core/stores/platform'
import ModuleBoundary from '@/ui/components/ModuleBoundary.vue'
import ToastHost from '@/ui/components/ToastHost.vue'

const platform = usePlatformStore()
const route = useRoute()
const title = computed(() => (route.meta.title as string | undefined) ?? '俄语学习平台')
</script>

<template>
  <div class="app-shell">
    <aside class="sidebar">
      <div class="brand">
        <span class="brand-mark">Р</span>
        <span>
          Русский
          <small>俄语学习平台</small>
        </span>
      </div>

      <nav class="nav">
        <div class="nav-section">学习模块</div>
        <RouterLink
          v-for="entry in platform.orderedMenu"
          :key="entry.id"
          class="nav-item"
          :to="{ name: entry.routeName }"
        >
          <span class="icon">{{ entry.icon }}</span>
          <span>{{ entry.title }}</span>
        </RouterLink>
      </nav>

      <div class="spacer" />
      <div class="faint" style="font-size: 11px">
        已加载 {{ platform.readyModules.length }} / {{ platform.modules.length }} 个模块
      </div>
    </aside>

    <div class="main">
      <header class="topbar">
        <h1>{{ title }}</h1>
        <div class="topbar-meta">
          <span v-if="platform.dbStatus === 'unavailable'" class="badge badge-learning">
            本地存储不可用（内存模式）
          </span>
          <span class="faint">数据本地优先</span>
        </div>
      </header>

      <div v-if="platform.dbStatus === 'unavailable'" class="card" style="margin: 12px 20px 0">
        <strong>降级提示：</strong>
        <span class="muted" style="font-size: 13px">
          当前环境无法使用 IndexedDB（如 Safari 隐私模式），已切换为内存态，刷新后数据会丢失。请及时在「统计」页导出备份。
        </span>
      </div>

      <main class="content">
        <RouterView v-slot="{ Component }">
          <ModuleBoundary>
            <component :is="Component" />
          </ModuleBoundary>
        </RouterView>
      </main>
    </div>

    <nav class="bottom-nav mobile-only">
      <RouterLink v-for="entry in platform.orderedMenu" :key="entry.id" :to="{ name: entry.routeName }">
        <span class="icon">{{ entry.icon }}</span>
        <span>{{ entry.title }}</span>
      </RouterLink>
    </nav>

    <ToastHost />
  </div>
</template>
