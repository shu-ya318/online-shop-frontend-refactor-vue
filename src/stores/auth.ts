import { computed, customRef, onScopeDispose } from 'vue'
import { defineStore } from 'pinia'

import { resetUserScopedStores } from '@/stores/plugins/userScoped'
import { tokenManager } from '@/services/http'
import { login as loginApi, logout as logoutApi, signup as signupApi } from '@/services/auth'
import { toApiError, type ApiError } from '@/services/errors'

import type { LoginRequest, SignupRequest } from '@/services/auth/interface'

/** 登出結果：本機一律登出，serverLoggedOut 表示後端是否成功 */
export type LogoutResult = { serverLoggedOut: true } | { serverLoggedOut: false; error: ApiError }

/**
 * 登入狀態：登入、註冊、登出，token 來源為 tokenManager。
 * refreshToken 由後端以 HttpOnly Cookie 管理，前端不持有也不儲存；
 * accessToken 的唯一來源是 tokenManager（持久化的 localStorage key 為 lookgo-auth），
 * store 不另存副本，而是用 customRef 訂閱 tokenManager，讓畫面跟著登入狀態更新。
 */
export const useAuthStore = defineStore('auth', () => {
  // 讀的時候直接問 tokenManager；tokenManager 通知變化時（登入、刷新、登出、登入失效）
  // 呼叫 trigger()，讓用到它的 computed 與畫面重新計算
  const tokenSource = customRef<string | null>((track, trigger) => {
    const unsubscribe = tokenManager.subscribe(() => trigger())
    // store 被 $dispose() 時取消訂閱（測試會反覆建立 store，不取消會累積訂閱者）
    onScopeDispose(unsubscribe)

    return {
      get() {
        track()
        return tokenManager.getAccessToken()
      },
      set() {
        // 唯讀：寫入一律經過 setAccessToken() / clearAuth()
      },
    }
  })

  /** 目前的 access token（唯讀） */
  const accessToken = computed(() => tokenSource.value)
  /** 是否已登入（持有 token） */
  const isAuthenticated = computed(() => accessToken.value !== null)

  /** 登入、註冊成功後開始新的工作階段 */
  const startSession = (token: string) => {
    resetUserScopedStores()
    tokenManager.setAccessToken(token)
  }

  /** 結束工作階段：清 token（之後同樣要重設使用者相關的 store） */
  const endSession = () => {
    tokenManager.clearAuth()
    resetUserScopedStores()
  }

  /** 登入並開始新工作階段；失敗 reject ApiError */
  const login = async (request: LoginRequest): Promise<void> => {
    const { accessToken: token } = await loginApi(request)
    startSession(token)
  }

  /** 註冊並開始新工作階段；失敗 reject ApiError */
  const signup = async (request: SignupRequest) => {
    const { accessToken: token } = await signupApi(request)
    startSession(token)
  }

  let logoutRequest: Promise<LogoutResult> | null = null

  // 先呼叫 API 再清 token：http.ts 對 /auth/log-out 會帶目前的 token，後端才能把它列入黑名單
  const runLogout = async (): Promise<LogoutResult> => {
    try {
      await logoutApi()
      return { serverLoggedOut: true }
    } catch (error) {
      return { serverLoggedOut: false, error: await toApiError(error) }
    } finally {
      endSession()
    }
  }

  /**
   * 登出。永遠 resolve（本機一定登出），回傳後端是否成功，由畫面決定顯示什麼訊息。
   * 避免 logout API 失敗就跳到 catch、連 token 都沒清，使用者登不出去。
   */
  const logout = (): Promise<LogoutResult> => {
    // 連點兩次登出只送一次
    logoutRequest ??= runLogout().finally(() => {
      logoutRequest = null
    })

    return logoutRequest
  }

  return { accessToken, isAuthenticated, login, signup, logout, endSession }
})
