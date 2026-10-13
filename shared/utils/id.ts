/**
 * ID 生成：浏览器用 crypto.randomUUID，小程序等环境降级为时间戳 + 随机串。
 * 不依赖 DOM 类型声明，保证在小程序 tsconfig（lib 不含 DOM）下也能通过检查。
 */
export function createId(prefix = ''): string {
  const scope = globalThis as typeof globalThis & {
    crypto?: { randomUUID?: () => string }
  }
  const uuid =
    typeof scope.crypto?.randomUUID === 'function'
      ? scope.crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
  return prefix ? `${prefix}_${uuid}` : uuid
}
