/**
 * 轻量 Web Vitals 采集（LCP / INP / CLS），无第三方依赖。
 * 上报目标可通过 VITE_VITALS_ENDPOINT 配置；默认仅输出到控制台，便于 CI 与本地核对。
 */
export interface VitalMetric {
  name: 'LCP' | 'INP' | 'CLS'
  value: number
  rating: 'good' | 'needs-improvement' | 'poor'
}

const BUDGET: Record<VitalMetric['name'], [number, number]> = {
  LCP: [2000, 4000],
  INP: [200, 500],
  CLS: [0.1, 0.25],
}

function rate(name: VitalMetric['name'], value: number): VitalMetric['rating'] {
  const [good, poor] = BUDGET[name]
  if (value <= good) return 'good'
  if (value <= poor) return 'needs-improvement'
  return 'poor'
}

const listeners = new Set<(metric: VitalMetric) => void>()

export function onVital(listener: (metric: VitalMetric) => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function report(name: VitalMetric['name'], value: number) {
  const metric: VitalMetric = { name, value, rating: rate(name, value) }
  listeners.forEach((listener) => listener(metric))
  const endpoint = import.meta.env.VITE_VITALS_ENDPOINT
  if (endpoint && typeof navigator.sendBeacon === 'function') {
    navigator.sendBeacon(endpoint, JSON.stringify(metric))
  }
  if (import.meta.env.DEV) {
    console.debug(`[vitals] ${name} = ${Math.round(value * 1000) / 1000} (${metric.rating})`)
  }
}

export function startVitals(): void {
  if (typeof window === 'undefined' || typeof PerformanceObserver === 'undefined') return

  // LCP
  try {
    const lcpObserver = new PerformanceObserver((list) => {
      const entries = list.getEntries()
      const last = entries[entries.length - 1]
      if (last) report('LCP', last.startTime)
    })
    lcpObserver.observe({ type: 'largest-contentful-paint', buffered: true })
  } catch {
    /* 不支持则跳过 */
  }

  // CLS
  try {
    let clsValue = 0
    const clsObserver = new PerformanceObserver((list) => {
      for (const entry of list.getEntries() as Array<PerformanceEntry & { hadRecentInput?: boolean; value?: number }>) {
        if (!entry.hadRecentInput && typeof entry.value === 'number') clsValue += entry.value
      }
      report('CLS', clsValue)
    })
    clsObserver.observe({ type: 'layout-shift', buffered: true })
  } catch {
    /* 不支持则跳过 */
  }

  // INP（event timing 近似）
  try {
    const inpObserver = new PerformanceObserver((list) => {
      let worst = 0
      for (const entry of list.getEntries()) {
        const duration = entry.duration ?? 0
        if (duration > worst) worst = duration
      }
      if (worst) report('INP', worst)
    })
    inpObserver.observe({ type: 'event', durationThreshold: 16, buffered: true } as PerformanceObserverInit)
  } catch {
    /* 不支持则跳过 */
  }
}
