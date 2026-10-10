import axios, { type AxiosAdapter, type AxiosInstance, type AxiosRequestConfig } from 'axios'

import { toApiError } from './errors'
import { createTokenManager, type TokenManager, type TokenStorage } from './tokenManager'

import type { AuthResponse } from './auth/interface'

declare module 'axios' {
  interface InternalAxiosRequestConfig {
    /** 這次請求實際帶出去的 access token；沒帶就是 undefined。收到 401 時用來判斷是否值得刷新 */
    _sentToken?: string
    /** 已經因為 401 刷新並重送過一次，避免無限重試 */
    _retried?: boolean
  }
}

export interface HttpClient {
  instance: AxiosInstance
  tokenManager: TokenManager
  post: <T>(url: string, data?: unknown, config?: AxiosRequestConfig) => Promise<T>
}

const BASE_URL = '/api/v1'
const REFRESH_URL = '/auth/refresh-tokens'
const LOGOUT_URL = '/auth/log-out'
const AUTH_ENDPOINTS = [
  '/auth/sign-up',
  '/auth/log-in',
  REFRESH_URL,
  LOGOUT_URL,
  '/auth/forget-password',
  '/auth/reset-password',
]

/**
 * 這些端點的 401 是「業務錯誤」，不代表 token 失效，不可以刷新、也不可以重送：
 * - /auth/*：帳號密碼錯誤、帳號停用、reset token 無效、refresh 失敗本身
 * - /user/update-password：舊密碼錯誤
 * 其餘端點的 401 一律視為 access token 失效。
 */
const NO_REFRESH_ON_401: readonly RegExp[] = [/^\/auth\//, /^\/user\/update-password$/]

const pathOf = (url?: string): string => (url ?? '').split('?')[0] ?? ''
const isAuthEndpoint = (url?: string) => AUTH_ENDPOINTS.includes(pathOf(url))
const canRefreshOn401 = (url?: string): boolean =>
  !NO_REFRESH_ON_401.some((pattern) => pattern.test(pathOf(url)))

export interface HttpClientOptions {
  /** 測試用：換掉實際發送請求的 adapter */
  adapter?: AxiosAdapter
  storage?: TokenStorage
  onAuthExpired?: () => void
}

export const createHttpClient = (options: HttpClientOptions = {}): HttpClient => {
  const instance = axios.create({
    baseURL: BASE_URL,
    timeout: 10000,
    adapter: options.adapter,
  })

  // 刷新請求不經過 instance 的 interceptor，避免刷新時又觸發刷新而無限遞迴
  const refreshClient = axios.create({
    baseURL: BASE_URL,
    timeout: 10000,
    adapter: options.adapter,
  })

  const tokenManager = createTokenManager({
    storage: options.storage,
    onAuthExpired: options.onAuthExpired,
    refresh: async () => {
      const { data } = await refreshClient.post<AuthResponse>(REFRESH_URL)
      return data.accessToken
    },
  })

  instance.interceptors.request.use(async (config) => {
    let token: string | null = null

    if (isAuthEndpoint(config.url)) {
      token = pathOf(config.url) === LOGOUT_URL ? tokenManager.getAccessToken() : null
    } else {
      try {
        token = await tokenManager.getValidAccessToken()
      } catch {
        // 刷新失敗：tokenManager 已處理登出；這次改成不帶 token 送出，
        // 需要登入的 API 會收到 401，因為沒有帶 token，不會再觸發一次刷新
        token = null
      }
    }

    if (token) {
      config.headers.set('Authorization', `Bearer ${token}`)
      config._sentToken = token
    } else {
      config.headers.delete('Authorization')
      config._sentToken = undefined
    }

    return config
  })

  instance.interceptors.response.use(undefined, async (error: unknown) => {
    if (axios.isAxiosError(error) && error.response?.status === 401 && error.config) {
      const config = error.config
      const sentToken = config._sentToken

      // 條件：這次有帶 token、還沒重送過、而且不是業務 401
      if (sentToken && !config._retried && canRefreshOn401(config.url)) {
        config._retried = true

        // 刷新失敗（含登出）就不重送，往下回傳原本的 401
        const newToken = await tokenManager.refreshAfterUnauthorized(sentToken)
        if (newToken) {
          // 重送時 request interceptor 會再向 tokenManager 取一次 token；
          // 重送後如果還是 401，因為 _retried 已經是 true，會直接轉成錯誤
          return instance.request(config)
        }
      }
    }

    // 403 也走這裡：只轉成 ApiError，不在 API 層整頁跳轉
    throw await toApiError(error)
  })

  const post = async <T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> => {
    const response = await instance.post<T>(url, data, config)
    return response.data
  }

  return { instance, tokenManager, post }
}

export const httpClient = createHttpClient()
export const { post, tokenManager } = httpClient

/**
 * 注入「登入已失效」的處理（refresh 失敗、STOMP 認證被拒）。
 * API 層不碰 window.location 與 router，由上層（store 或路由）決定怎麼處理，
 * 例如：清空使用者相關的 store，再 router.push({ name: 'login' })。
 */
export const setOnAuthExpired = (handler: (() => void) | null) => {
  tokenManager.setOnAuthExpired(handler)
}
