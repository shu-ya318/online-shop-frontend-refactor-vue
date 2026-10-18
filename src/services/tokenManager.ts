import axios from 'axios'
import { jwtDecode } from 'jwt-decode'

/** access token 存放在 localStorage 的 key */
export const ACCESS_TOKEN_STORAGE_KEY = 'lookgo-auth'
/** 預設提前刷新的緩衝時間：距離過期不到 30 秒就視為快過期 */
export const DEFAULT_REFRESH_LEEWAY_MS = 30_000

/** access token 的儲存介面，可抽換實作（測試用記憶體、正式用 localStorage） */
export interface TokenStorage {
  get: () => string | null
  set: (token: string) => void
  remove: () => void
}

/** createTokenManager 的選項 */
export interface TokenManagerOptions {
  /** 呼叫後端刷新 token，回傳新的 access token */
  refresh: () => Promise<string>
  /** 儲存體；未提供時用 createLocalTokenStorage() */
  storage?: TokenStorage
  /** 刷新確認 session 已失效（refresh token 無效）且清除登入狀態後觸發 */
  onAuthExpired?: () => void
  /** 提前刷新的緩衝毫秒數，預設 DEFAULT_REFRESH_LEEWAY_MS */
  leewayMs?: number
  /** 取得目前時間（毫秒），測試用，預設 Date.now */
  now?: () => number
}

/** access token 的管理介面：讀寫、刷新（single-flight）、登入失效通知、狀態訂閱 */
export interface TokenManager {
  /** 讀取目前的 access token，沒有則為 null */
  getAccessToken: () => string | null
  /** 寫入 token 並通知訂閱者；傳 null 等同清除 */
  setAccessToken: (token: string | null) => void
  /** 取得可用的 access token：快過期會先刷新；多個請求同時刷新時共用同一個 Promise */
  getValidAccessToken: () => Promise<string | null>
  /** 手動刷新 token；刷新進行中再呼叫會共用同一個 Promise */
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
  /** 清除 token 並通知訂閱者，不觸發 onAuthExpired（用於一般登出） */
  clearAuth: () => void
  /** token 變化（登入、刷新、登出、登入失效）時通知；回傳取消訂閱的函式 */
  subscribe: (listener: () => void) => () => void
}

/** 解碼 JWT 取出 `exp`（秒）；不是 JWT 或沒有有效 exp 時回傳 null（只解碼、不驗簽） */
export const readTokenExpiry = (token: string): number | null => {
  try {
    const { exp } = jwtDecode<{ exp?: unknown }>(token)
    return typeof exp === 'number' && Number.isFinite(exp) ? exp : null
  } catch {
    return null
  }
}

/** 以 localStorage 實作的 TokenStorage；localStorage 不可用時退回記憶體 */
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

/**
 * 建立 token 管理器：
 * - 快過期才刷新，多個請求同時刷新只送一次（single-flight）
 * - 只有 refresh 回 401/403 才視為登入失效；網路錯誤保留登入狀態
 * - 刷新期間若 token 被換掉（重新登入）或清除（登出），不覆蓋也不寫回
 */
export const createTokenManager = (options: TokenManagerOptions): TokenManager => {
  const {
    storage = createLocalTokenStorage(),
    leewayMs = DEFAULT_REFRESH_LEEWAY_MS,
    now = Date.now,
  } = options

  let inFlight: Promise<string> | null = null
  let onAuthExpired = options.onAuthExpired

  const getAccessToken = () => storage.get()

  const listeners = new Set<() => void>()

  const subscribe = (listener: () => void) => {
    listeners.add(listener)

    return () => {
      listeners.delete(listener)
    }
  }

  const notify = () => {
    listeners.forEach((listener) => listener())
  }

  const clearAuth = () => {
    storage.remove()
    notify()
  }

  const setAccessToken = (token: string | null) => {
    if (token) {
      storage.set(token)
    } else {
      storage.remove()
    }

    notify()
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
    subscribe,
  }
}
