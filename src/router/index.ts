import { authGuard, titleHook } from '@/router/guards'
import { routes } from '@/router/routes'
import type { RouterHistory } from 'vue-router'
import { createRouter, createWebHistory } from 'vue-router'

/**
 * 建立 router。測試時傳 createMemoryHistory()，不碰瀏覽器網址列。
 * 守衛裡用到 Pinia store，所以 app.use(pinia) 必須在第一次導覽之前（main.ts 的順序）。
 *
 * @param history 路由歷史模式，預設為 `createWebHistory(import.meta.env.BASE_URL)`
 * @returns 已掛上 `authGuard`（beforeEach）與 `titleHook`（afterEach）的 router
 */
export const createAppRouter = (
  history: RouterHistory = createWebHistory(import.meta.env.BASE_URL),
) => {
  const router = createRouter({
    history,
    routes,
    // 換頁時回到頂端；按上一頁時回到原本捲動的位置（React 版沒有處理）
    scrollBehavior: (_to, _from, savedPosition) => savedPosition ?? { top: 0 },
  })
  router.beforeEach(authGuard)
  router.afterEach(titleHook)

  return router
}

/** 應用程式使用的 router 單例（main.ts 掛載用） */
const router = createAppRouter()
export default router
