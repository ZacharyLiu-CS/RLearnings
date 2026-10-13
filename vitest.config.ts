import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    // wx 桩让小程序端数据层也能在 Node 下被覆盖
    setupFiles: ['tests/setup-wx.ts'],
    include: ['src/**/*.spec.ts', 'shared/**/*.spec.ts', 'miniprogram/**/*.spec.ts'],
    restoreMocks: true,
  },
})
