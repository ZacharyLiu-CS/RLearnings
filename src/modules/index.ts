/**
 * 模块注册表：接入新模块只需在此加一行 registerModule(...)，无需改动核心代码。
 */
import { registerModule } from '@/core/module-registry'
import { wordsModule } from './words'
import { sentencesModule } from './sentences'

export function registerBuiltinModules(): void {
  registerModule(wordsModule)
  registerModule(sentencesModule)
}
