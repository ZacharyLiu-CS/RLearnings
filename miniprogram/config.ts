/**
 * 小程序端运行配置。
 *
 * 拍照识别有两条路径，按优先级自动选择：
 * 1. 配了 ocrEndpoint → 走服务端 OCR 接口（wx.uploadFile，准确率最好）；
 * 2. 没配接口但用户填了 AI Key → 走 DeepSeek 视觉模型（chat/completions + base64，零服务端成本）。
 * Tesseract.js 在小程序内不可用（无 WASM/Worker 能力、包体受限），故不采用。
 */
export const config = {
  /** 服务端 OCR 接口地址，形如 https://your-bff.example.com/api/ocr；留空则走视觉模型或隐藏入口 */
  ocrEndpoint: '',
  /**
   * 视觉模型名。DeepSeek 侧目前只有带 -exp 的实验模型支持图片输入，
   * 其他模型传图片会返回 400；模型改名时只改这里。
   */
  visionModel: 'deepseek-v4-flash-vision-exp',
  /** 演示数据规模（小程序 Storage 上限 10MB，控制在千级） */
  demoSeedSize: 1000,
}
