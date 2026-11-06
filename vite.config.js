import { defineConfig } from 'vite'
import uni from '@dcloudio/vite-plugin-uni'

// https://vitejs.dev/config/
// uni() 插件负责：识别 pages.json / manifest.json、按平台编译（这里是小程序 mp-weixin）、
// 把 src 目录编译成微信小程序可运行的 wxml/wxss/js。
export default defineConfig({
  plugins: [uni()],
  // 小程序端不需要浏览器 polyfill，保持默认即可
  build: {
    // 小程序构建产物不需要 sourcemap，关掉可以让构建更快
    sourcemap: false
  }
})
