import { createSSRApp } from 'vue'
import App from './App.vue'

/**
 * uni-app 的项目入口（等价于 Vue 的 main.js）
 *
 * 为什么用 createSSRApp 而不是 createApp：
 * uni-app 要在小程序 / H5 / App 等多端复用同一套代码，
 * 统一使用 SSR 兼容的创建方式，小程序端会忽略 SSR 相关逻辑。
 *
 * 注意：这里【不要】写 new Vue() / app.mount()，
 * 页面挂载由 uni-app 运行时负责。
 */
export function createApp() {
  const app = createSSRApp(App)
  return {
    app
  }
}
