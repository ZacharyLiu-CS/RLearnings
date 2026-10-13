/**
 * 小程序端运行配置。
 * OCR 在小程序内无法用 Tesseract.js（无 WASM/Worker 能力、包体受限），
 * 改由服务端 OCR 接口提供：拍照/选图 → wx.uploadFile → 返回识别行。
 */
export const config = {
  /** 服务端 OCR 接口地址，形如 https://your-bff.example.com/api/ocr；留空则 OCR 入口降级提示 */
  ocrEndpoint: '',
  /** 演示数据规模（小程序 Storage 上限 10MB，控制在千级） */
  demoSeedSize: 1000,
}
