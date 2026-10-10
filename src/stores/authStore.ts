import { computed, ref } from 'vue'
import { defineStore } from 'pinia'

import { setOnAuthExpired, tokenManager } from '@/services/http'

// refreshToken 由後端以 HttpOnly Cookie 管理，前端不持有也不儲存
// accessToken 的持久化（localStorage key 為 lookgo-auth，值是 token 字串本身）統一由 tokenManager 負責，
// store 只保存一份響應式的副本，讓畫面能跟著登入狀態更新
export const useAuthStore = defineStore('auth', () => {
  const accessToken = ref<string | null>(tokenManager.getAccessToken())

  const isAuthenticated = computed(() => accessToken.value !== null)

  const setAccessToken = (token: string | null) => {
    tokenManager.setAccessToken(token)
    accessToken.value = token
  }

  const clearAuth = () => {
    tokenManager.clearAuth()
    accessToken.value = null
  }

  /** tokenManager 在背景刷新 token 或判定登入失效後，用這個把 store 對齊儲存的值 */
  const syncFromStorage = () => {
    accessToken.value = tokenManager.getAccessToken()
  }

  // refresh 失敗或 STOMP 認證被拒時，tokenManager 已清掉儲存的 token，這裡把 store 對齊
  setOnAuthExpired(syncFromStorage)

  return { accessToken, isAuthenticated, setAccessToken, clearAuth, syncFromStorage }
})
