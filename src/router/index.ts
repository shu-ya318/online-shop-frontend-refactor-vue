import { createRouter, createWebHistory } from 'vue-router'

/**
 * 建立 router。測試時傳 createMemoryHistory()，不碰瀏覽器網址列。
 * 守衛裡用到 Pinia store，所以 app.use(pinia) 必須在第一次導覽之前（main.ts 的順序）。
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

const router = createAppRouter()
export default router
