import { fileURLToPath } from 'node:url'
import { mergeConfig, defineConfig, configDefaults } from 'vitest/config'
import viteConfig from './vite.config.ts'

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      // 元件測試用 jsdom；services 與 utils 的測試檔用 `@vitest-environment node` 改成 Node 環境
      environment: 'jsdom',
      exclude: [...configDefaults.exclude, 'e2e/**'],
      setupFiles: ['./src/test/setup.ts'],
      root: fileURLToPath(new URL('./', import.meta.url)),
      // 固定時區，日期相關測試在任何機器上結果都一樣（台灣使用者的時區）
      env: {
        TZ: 'Asia/Taipei',
      },
      server: {
        deps: {
          inline: ['vuetify'],
        },
      },
    },
  }),
)
