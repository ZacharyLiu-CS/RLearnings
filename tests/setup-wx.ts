/**
 * 测试环境里的 wx 桩：让小程序端数据层可以在 Node 下被单测覆盖。
 * 只实现 Storage 与常用交互 API，行为与真机一致（同步读写、键级删除）。
 */
const store = new Map<string, unknown>()

const wxStub = {
  getStorageSync<T = unknown>(key: string): T | '' {
    return store.has(key) ? (store.get(key) as T) : ''
  },
  setStorageSync(key: string, value: unknown): void {
    store.set(key, value)
  },
  removeStorageSync(key: string): void {
    store.delete(key)
  },
  clearStorageSync(): void {
    store.clear()
  },
  getStorageInfoSync(): { currentSize: number; limitSize: number; keys: string[] } {
    return { currentSize: store.size, limitSize: 10240, keys: [...store.keys()] }
  },
  showToast(): void {
    /* noop */
  },
  showModal(): void {
    /* noop */
  },
  navigateTo(): void {
    /* noop */
  },
  switchTab(): void {
    /* noop */
  },
  vibrateShort(): void {
    /* noop */
  },
}

;(globalThis as typeof globalThis & { wx?: unknown }).wx = wxStub

export {}
