import type {
  NavigationGuard,
  NavigationHookAfter,
  RouteLocationNormalized,
  RouteLocationRaw,
} from 'vue-router'
import { START_LOCATION } from 'vue-router'

import { notify } from '@/composables/notify'
import { getSafeRedirect } from '@/router/redirect'
import { getErrorMessage, isApiError } from '@/services/errors'
import { UserRole } from '@/services/user/types'
import { useAuthStore } from '@/stores/auth'
import { useUserStore } from '@/stores/user'

/** 分頁標題的固定後綴，沒有 meta.title 時單獨使用 */
const APP_TITLE = 'lookGo'

/** 是否為 401（登入已失效） */
const isSessionExpired = (error: unknown): boolean => isApiError(error) && error.status === 401

/** 導到登入頁，並帶上原本要去的網址 */
const loginRedirect = (to: RouteLocationNormalized): RouteLocationRaw => ({
  name: 'login',
  query: { redirect: to.fullPath },
})

/**
 * 依 meta.title 設定分頁標題（React 版所有頁面都是 index.html 的 lookGo-frontend）。
 * 導覽失敗（被取消、被重新導向）時不改標題。
 */
export const titleHook: NavigationHookAfter = (to, _from, failure) => {
  if (failure) {
    return
  }

  document.title = to.meta.title ? `${to.meta.title} - ${APP_TITLE}` : APP_TITLE
}

/**
 * 需要管理員、但確認不了身分（網路斷線、逾時、5xx）。
 * 不能當成「沒有權限」導到 /unauthorized（React 版 AdminGuard 的問題），
 * 也不能放行（畫面會先顯示管理頁的骨架）。做法：
 * - 從別頁點過來：取消這次導覽，停在原頁並顯示錯誤，使用者可以再點一次
 * - 直接開網址（第一次導覽，畫面上還沒有任何頁面）：改去首頁並顯示錯誤，避免整頁空白
 *
 * @param error ensureUser() 拋出的錯誤（非 401）
 * @param from 導覽的來源路由；等於 START_LOCATION 代表第一次導覽
 * @returns 第一次導覽回傳首頁路由，否則回傳 false（取消導覽）
 */
const handleUnverifiedAdmin = (
  error: unknown,
  from: RouteLocationNormalized,
): RouteLocationRaw | false => {
  notify.error(`無法確認管理員權限：${getErrorMessage(error)}`)
  return from === START_LOCATION ? { name: 'home' } : false
}

/**
 * 登入與權限檢查，取代 React 版的三個地方：
 * - router.tsx:37-44 requireAuthLoader：只看「有沒有 token」
 * - router.tsx:49-67、91-108 兩個 loader：有 token 就抓使用者資料，失敗一律吞掉放行
 * - AdminGuard.tsx：元件層檢查 role，loader 抓資料失敗時（例如網路斷線）管理員會被誤導到 /unauthorized
 *
 * 規則：
 * | 情況 | 結果 |
 * |---|---|
 * | 需要登入、沒有 token | 登入頁，帶 ?redirect=原網址 |
 * | 只給訪客（/auth/*）、已登入 | 確認身分成功就導到 redirect（只接受站內路徑）或首頁；確認失敗留在原頁 |
 * | 需要登入、有 token | 等 ensureUser()：401 → 登入頁；網路錯誤 → 放行（頁面自己的 API 會顯示錯誤） |
 * | 需要管理員 | 是管理員 → 放行；不是 → /unauthorized；401 → 登入頁；網路錯誤 → 不判定權限（見 handleUnverifiedAdmin） |
 * | 公開頁、有 token | 背景載入使用者資料（Header 要顯示），不等它、不擋導覽 |
 *
 * @param to 目標路由，讀取其 meta（requiresAuth / requiresAdmin / guestOnly）
 * @param from 來源路由，僅用於判斷是否為第一次導覽
 * @returns `true` 放行；路由物件為重新導向；`false` 取消導覽
 */
export const authGuard: NavigationGuard = async (to, from) => {
  const auth = useAuthStore()
  const user = useUserStore()
  const { requiresAuth, requiresAdmin, guestOnly } = to.meta

  if (!auth.isAuthenticated) {
    return requiresAuth || requiresAdmin ? loginRedirect(to) : true
  }

  // ===== 以下都有 token；「有 token」不代表登入有效，要問過後端才知道 =====
  if (guestOnly) {
    try {
      const currentUser = await user.ensureUser()
      if (currentUser) {
        return getSafeRedirect(to.query.redirect) ?? { name: 'home' }
      }
    } catch {
      // 確認不了（token 失效或網路錯誤）就讓使用者留在登入頁重新登入（與 React 版 loader 相同）
    }

    return true
  }

  if (requiresAuth || requiresAdmin) {
    let currentUser

    try {
      currentUser = await user.ensureUser()
    } catch (error) {
      if (isSessionExpired(error)) {
        return loginRedirect(to)
      }

      if (requiresAdmin) {
        return handleUnverifiedAdmin(error, from)
      }

      // 一般需要登入的頁面：抓不到使用者資料不等於沒登入，先放行
      return true
    }
    // 等待期間 token 被清掉（例如另一個請求判定登入失效）
    if (!currentUser) {
      return loginRedirect(to)
    }

    if (requiresAdmin && currentUser.role !== UserRole.ADMIN) {
      return { name: 'not-authorized' }
    }

    return true
  }

  // 公開頁：Header 要顯示使用者名稱與管理員選單，但不需要等它
  user.ensureUser().catch(() => {
    // 401 由 onAuthExpired 處理；網路錯誤時 Header 先顯示預設頭像，下一次導覽會再試
  })

  return true
}
