/**
 * Apple 运动圆环风格的进度环（小程序 / canvas 2d 实现）。
 * 用 canvas 而非 CSS 渐变环：各端 webview 兼容性最稳，且能画渐变与圆头端点。
 */
const ANIM_MS = 550

/** 小程序 tsconfig 不含 DOM lib，这里只声明用到的 canvas 2d 能力 */
interface Gradient {
  addColorStop(stop: number, color: string): void
}

interface Ctx2D {
  lineCap: string
  lineWidth: number
  strokeStyle: string | Gradient
  scale(x: number, y: number): void
  clearRect(x: number, y: number, width: number, height: number): void
  beginPath(): void
  arc(x: number, y: number, radius: number, startAngle: number, endAngle: number): void
  stroke(): void
  createLinearGradient(x0: number, y0: number, x1: number, y1: number): Gradient
}

interface CanvasNode {
  width: number
  height: number
  getContext(type: string): Ctx2D
}

interface RingState {
  ctx: Ctx2D | null
  timer: number
  current: number
}

function stateOf(self: unknown): RingState {
  const holder = self as { _state?: RingState }
  if (!holder._state) holder._state = { ctx: null, timer: 0, current: 0 }
  return holder._state
}

Component({
  properties: {
    /** 0 - 1 */
    progress: {
      type: Number,
      value: 0,
      observer() {
        this.animateTo()
      },
    },
    size: { type: Number, value: 150 },
    thickness: { type: Number, value: 12 },
    from: { type: String, value: '#d4321f' },
    to: { type: String, value: '#ff9500' },
    track: { type: String, value: 'rgba(17,17,17,0.08)' },
    complete: {
      type: Boolean,
      value: false,
      observer() {
        this.animateTo()
      },
    },
  },

  lifetimes: {
    attached() {
      this.initCanvas()
    },
    detached() {
      const state = stateOf(this)
      if (state.timer) clearInterval(state.timer)
      state.timer = 0
    },
  },

  methods: {
    initCanvas() {
      const query = wx.createSelectorQuery().in(this)
      query
        .select('#ring')
        .fields({ node: true, size: true })
        .exec((res: Array<{ node?: CanvasNode }>) => {
          const info = res?.[0]
          if (!info?.node) return
          const canvas = info.node
          const ctx = canvas.getContext('2d')
          const dpr = wx.getSystemInfoSync().pixelRatio || 2
          canvas.width = this.data.size * dpr
          canvas.height = this.data.size * dpr
          ctx.scale(dpr, dpr)
          const state = stateOf(this)
          state.ctx = ctx
          state.current = this.data.progress
          this.draw(this.data.progress)
        })
    },

    animateTo() {
      const state = stateOf(this)
      if (!state.ctx) return // 画布未就绪：attached 后会补画一次
      if (state.timer) clearInterval(state.timer)

      const start = state.current
      const target = Math.min(1, Math.max(0, this.data.progress))
      const begin = Date.now()

      state.timer = setInterval(() => {
        const t = Math.min(1, (Date.now() - begin) / ANIM_MS)
        const eased = 1 - Math.pow(1 - t, 3)
        state.current = start + (target - start) * eased
        this.draw(state.current)
        if (t >= 1) {
          clearInterval(state.timer)
          state.timer = 0
        }
      }, 16) as unknown as number
    },

    draw(value: number) {
      const state = stateOf(this)
      const ctx = state.ctx
      if (!ctx) return
      const { size, thickness, track, from, to, complete } = this.data
      const c = size / 2
      const r = c - thickness / 2
      const clamped = Math.min(1, Math.max(0, value))

      ctx.clearRect(0, 0, size, size)
      ctx.lineCap = 'round'
      ctx.lineWidth = thickness

      ctx.beginPath()
      ctx.arc(c, c, r, 0, Math.PI * 2)
      ctx.strokeStyle = track
      ctx.stroke()

      if (clamped <= 0.001) return

      const gradient = ctx.createLinearGradient(0, 0, size, size)
      gradient.addColorStop(0, complete ? '#0f6b4f' : from)
      gradient.addColorStop(1, complete ? '#3ecf8e' : to)

      ctx.beginPath()
      ctx.arc(c, c, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * clamped)
      ctx.strokeStyle = gradient
      ctx.stroke()
    },
  },
})
