<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink, RouterView, useRoute } from 'vue-router'
import { usePlatformStore } from '@/core/stores/platform'
import ModuleBoundary from '@/ui/components/ModuleBoundary.vue'
import ToastHost from '@/ui/components/ToastHost.vue'
import AppIcon from '@/ui/components/AppIcon.vue'

const platform = usePlatformStore()
const route = useRoute()
const title = computed(() => (route.meta.title as string | undefined) ?? '俄语学习平台')
</script>

<template>
  <div class="app-shell">
    <aside class="sidebar">
      <div class="brand">
        <span class="brand-mark">Р</span>
        <span class="brand-text">
          Русский
          <small>Russian Learning</small>
        </span>
      </div>

      <nav class="nav">
        <div class="nav-section micro">Modules</div>
        <RouterLink
          v-for="entry in platform.orderedMenu"
          :key="entry.id"
          class="nav-item"
          :to="{ name: entry.routeName }"
        >
          <AppIcon :name="entry.icon as never" :size="17" />
          <span class="label">{{ entry.title }}</span>
        </RouterLink>
      </nav>

      <div class="sidebar-foot micro">
        {{ platform.readyModules.length }} / {{ platform.modules.length }} modules ready
      </div>
    </aside>

    <div class="main">
      <header class="topbar">
        <h1>{{ title }}</h1>
        <div class="topbar-meta">
          <span v-if="platform.dbStatus === 'unavailable'" class="badge badge-learning">
            本地存储不可用
          </span>
          <span class="faint micro">Local-first</span>
        </div>
      </header>

      <div v-if="platform.dbStatus === 'unavailable'" class="notice" style="margin: 16px 24px 0">
        当前环境无法使用 IndexedDB（如 Safari 隐私模式），已切换为内存态，刷新后数据会丢失。请及时在「统计」页导出备份。
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
        <AppIcon :name="entry.icon as never" :size="20" />
        <span class="nav-label">{{ entry.title }}</span>
      </RouterLink>
    </nav>

    <ToastHost />
  </div>
</template>
