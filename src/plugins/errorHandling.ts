import type { App } from 'vue'
import type { Router } from 'vue-router'

import { notify } from '@/composables/notify'

/** 動態 import 的檔案載入失敗（部署新版本後舊的 chunk 檔名已經不存在、或網路斷線） */
const isChunkLoadError = (error: unknown): boolean =>
  error instanceof Error &&
  /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module/i.test(
    error.message,
  )
/**
（略過第 14 行的註解）
 *
 * React 版沒有 ErrorBoundary，任何 render 錯誤都會變成 React Router 的預設錯誤頁（整頁英文錯誤訊息）。
 * Vue 元件 render 或生命週期出錯不會讓整個 App 卸載，但預設只印在 console，使用者不知道發生什麼事。
 * - app.config.errorHandler：元件、watcher、生命週期鉤子裡沒有被接住的錯誤
 * - router.onError：路由守衛丟出例外、頁面元件（() => import()）下載失敗
 */
export const installErrorHandling = (app: App, router: Router): void => {
  app.config.errorHandler = (error, _instance, info) => {
    console.error(`[app] ${info}`, error)
    notify.error('畫面發生錯誤，請重新整理頁面後再試')
  }
  router.onError((error) => {
    console.error('[router]', error)
    notify.error(
      isChunkLoadError(error)
        ? '頁面載入失敗，請確認網路連線或重新整理頁面'
        : '頁面切換時發生錯誤，請稍後再試',
    )
  })
}
