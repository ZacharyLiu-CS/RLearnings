import { repository } from './core/storage'

App({
  onLaunch() {
    // 冷启动预热索引；读取失败时以空词库启动，页面层有空态兜底
    try {
      void repository.count()
    } catch (err) {
      console.error('[app] 本地存储初始化失败', err)
    }
  },
})
