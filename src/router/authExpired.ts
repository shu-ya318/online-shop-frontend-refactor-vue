import type { Pinia } from 'pinia'
import type { Router } from 'vue-router'

import { notify } from '@/composables/notify'
import { setOnAuthExpired } from '@/services/http'
import { resetUserScopedStores } from '@/stores/plugins/userScoped'

/**
 * 註冊「登入失效」處理：重置與使用者綁定的 store、顯示提示；
 * 若目前頁面需要登入或管理員，導到登入頁並帶上 `redirect`。
 *
 * @param router 用來讀取目前路由並導頁
 * @param pinia 用來重置 user-scoped stores
 * @returns 解除註冊的函式（呼叫後 `setOnAuthExpired(null)`）
 */
export const installAuthExpiredHandler = (router: Router, pinia: Pinia): (() => void) => {
  setOnAuthExpired(() => {
    resetUserScopedStores(pinia)
    notify.warning('登入已失效，請重新登入')
    const current = router.currentRoute.value
    if (current.meta.requiresAuth || current.meta.requiresAdmin) {
      void router.push({ name: 'login', query: { redirect: current.fullPath } })
    }
  })
  return () => setOnAuthExpired(null)
}
