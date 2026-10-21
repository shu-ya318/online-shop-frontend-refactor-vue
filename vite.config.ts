import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'
import vuetify from 'vite-plugin-vuetify'

// https://vite.dev/config/
export default defineConfig({
  envDir: 'env',
  plugins: [
    vue(),
    vueDevTools(),
    // 自動載入：template 裡用到哪個 v-xxx 元件才 import 哪個（不用在 main.ts 註冊全部元件）。
    // configFile：用 Sass 覆寫 Vuetify 的斷點與字級（見 src/styles/settings.scss），
    // 只設 createVuetify 的 display.thresholds 不會改到 d-md-none 這類 CSS class 的斷點。
    vuetify({
      autoImport: true,
      styles: {
        configFile: 'src/styles/settings.scss',
      },
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    proxy: {
      '/api/v1': {
        target: 'http://localhost:8082',
        changeOrigin: true,
      },
      '/ws': {
        target: 'ws://localhost:8082',
        ws: true,
      },
    },
  },
})
