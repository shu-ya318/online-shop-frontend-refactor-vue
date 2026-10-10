import axios from 'axios'
import { jwtDecode } from 'jwt-decode'

export const ACCESS_TOKEN_STORAGE_KEY = 'lookgo-auth'
export const DEFAULT_REFRESH_LEEWAY_MS = 30_000

export interface TokenStorage {
  get: () => string | null
  set: (token: string) => void
  remove: () => void
}

export interface TokenManagerOptions {
  /** 呼叫後端刷新 token，回傳新的 access token */
  refresh: () => Promise<string>
  storage?: TokenStorage
  /** 刷新確認 session 已失效（refresh token 無效）且清除登入狀態後觸發 */
  onAuthExpired?: () => void
  leewayMs?: number
  now?: () => number
}

export interface TokenManager {
  getAccessToken: () => string | null
  setAccessToken: (token: string | null) => void
  /** 取得可用的 access token：快過期會先刷新；多個請求同時刷新時共用同一個 Promise */
  getValidAccessToken: () => Promise<string | null>
  refresh: () => Promise<string>
  /**
   * 收到 401 後呼叫：回傳可重送的新 token；刷新失敗（含已登出）回傳 null，呼叫端就不重送、回拋原本的 401。
   * 若送出請求後 token 已被別的請求刷新過，直接回傳目前的 token，不再多刷新一次。
   */
  refreshAfterUnauthorized: (sentToken: string) => Promise<string | null>
  /** 注入「登入已失效」的處理（refresh 失敗、STOMP 認證被拒）；API 層不碰 window.location 與 router */
  setOnAuthExpired: (handler: (() => void) | null) => void
  /** 判定登入已失效：清除 token，若原本有登入就通知 onAuthExpired */
  expireSession: () => void
  clearAuth: () => void
}

export const readTokenExpiry = (token: string): number | null => {
  try {
    const { exp } = jwtDecode<{ exp?: unknown }>(token)
    return typeof exp === 'number' && Number.isFinite(exp) ? exp : null
  } catch {
    return null
  }
}

export const createLocalTokenStorage = (key = ACCESS_TOKEN_STORAGE_KEY): TokenStorage => {
  // localStorage 可能被停用（隱私模式等），失敗時退回記憶體，避免整個登入流程壞掉
  let memory: string | null = null

  return {
    get: () => {
      try {
        return localStorage.getItem(key) ?? memory
      } catch {
        return memory
      }
    },
    set: (token) => {
      memory = token
      try {
        localStorage.setItem(key, token)
      } catch {
        // 忽略：已存入記憶體
      }
    },
    remove: () => {
      memory = null
      try {
        localStorage.removeItem(key)
      } catch {
        // 忽略
      }
    },
  }
}

const isSessionExpiredError = (error: unknown): boolean =>
  axios.isAxiosError(error) && (error.response?.status === 401 || error.response?.status === 403)

export const createTokenManager = (options: TokenManagerOptions): TokenManager => {
  const {
    storage = createLocalTokenStorage(),
    leewayMs = DEFAULT_REFRESH_LEEWAY_MS,
    now = Date.now,
  } = options

  let inFlight: Promise<string> | null = null
  let onAuthExpired = options.onAuthExpired

  const getAccessToken = () => storage.get()

  const clearAuth = () => {
    storage.remove()
  }

  const setAccessToken = (token: string | null) => {
    if (token) {
      storage.set(token)
    } else {
      storage.remove()
    }
  }

  const isExpiring = (token: string) => {
    const exp = readTokenExpiry(token)
    if (exp === null) {
      return true
    }

    return exp * 1000 - leewayMs <= now()
  }

  const expireSession = () => {
    const hadToken = storage.get() !== null

    clearAuth()

    if (hadToken) {
      onAuthExpired?.()
    }
  }

  const runRefresh = async (): Promise<string> => {
    const startedWith = storage.get()

    let newToken: string

    try {
      newToken = await options.refresh()
    } catch (error) {
      if (isSessionExpiredError(error) && storage.get() === startedWith) {
        expireSession()
      }

      throw error
    }

    const current = storage.get()
    if (current !== startedWith) {
      // 刷新期間 token 已被其他流程更換（重新登入）或清除（登出）
      if (current) {
        return current
      }

      throw new Error('刷新期間已登出，捨棄這次刷新結果')
    }

    setAccessToken(newToken)

    return newToken
  }

  const refresh = (): Promise<string> => {
    inFlight ??= runRefresh().finally(() => {
      inFlight = null
    })

    return inFlight
  }

  const getValidAccessToken = async (): Promise<string | null> => {
    if (inFlight) {
      return inFlight
    }

    const token = storage.get()

    if (!token) {
      return null
    }

    if (!isExpiring(token)) {
      return token
    }

    return refresh()
  }

  const refreshAfterUnauthorized = async (sentToken: string): Promise<string | null> => {
    const current = storage.get()

    if (current && current !== sentToken) {
      return current
    }

    try {
      return await refresh()
    } catch {
      return null
    }
  }

  const setOnAuthExpired = (handler: (() => void) | null) => {
    onAuthExpired = handler ?? undefined
  }

  return {
    getAccessToken,
    setAccessToken,
    getValidAccessToken,
    refresh,
    refreshAfterUnauthorized,
    expireSession,
    setOnAuthExpired,
    clearAuth,
  }
}
