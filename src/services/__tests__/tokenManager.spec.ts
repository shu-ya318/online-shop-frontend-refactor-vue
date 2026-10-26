// @vitest-environment node
import { AxiosError } from 'axios'
import { describe, it, expect, vi } from 'vitest'
import {
  createLocalTokenStorage,
  createTokenManager,
  readTokenExpiry,
  type TokenStorage,
} from '@/services/tokenManager'

const NOW_MS = 1_800_000_000_000
const NOW_SEC = NOW_MS / 1000

const base64Url = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url')

// jwtDecode 只解碼不驗簽，測試用的 token 不需要真的簽章
const makeToken = (exp: number | undefined, tag: string) =>
  `${base64Url({ alg: 'none', typ: 'JWT' })}.${base64Url({ exp, tag })}.sig`

const expiredToken = makeToken(NOW_SEC - 60, 'expired')
const expiringToken = makeToken(NOW_SEC + 10, 'expiring') // 在 30 秒 leeway 內
const validToken = makeToken(NOW_SEC + 3600, 'valid')
const freshToken = makeToken(NOW_SEC + 3600, 'fresh')

const createDeferred = <T>() => {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })

  return { promise, resolve, reject }
}

const createMemoryStorage = (initial: string | null): TokenStorage => {
  let value = initial

  return {
    get: () => value,
    set: (token) => {
      value = token
    },
    remove: () => {
      value = null
    },
  }
}

const createHttpError = (status: number) =>
  new AxiosError('request failed', 'ERR_BAD_REQUEST', undefined, undefined, {
    status,
    statusText: '',
    headers: {},
    config: {} as never,
    data: null,
  })

const setup = (initialToken: string | null) => {
  const storage = createMemoryStorage(initialToken)
  const refresh = vi.fn<() => Promise<string>>()
  const onAuthExpired = vi.fn<() => void>()
  const manager = createTokenManager({ refresh, storage, onAuthExpired, now: () => NOW_MS })

  return { manager, storage, refresh, onAuthExpired }
}

describe('readTokenExpiry', () => {
  // Scenario: readTokenExpiry —— 有效 JWT 回傳 exp 秒數
  it('回傳 exp 秒數', () => {
    expect(readTokenExpiry(validToken)).toBe(NOW_SEC + 3600)
  })

  // Scenario: readTokenExpiry 無效輸入 —— 非 JWT 或沒有 exp 一律回 null
  it('非 JWT 或沒有 exp 時回傳 null', () => {
    expect(readTokenExpiry('not-a-jwt')).toBeNull()
    expect(readTokenExpiry(makeToken(undefined, 'no-exp'))).toBeNull()
  })
})

describe('tokenManager：getValidAccessToken', () => {
  // Scenario: 無 token —— 未登入回 null，不呼叫 refresh
  it('沒有 token 時回傳 null，不刷新', async () => {
    const { manager, refresh } = setup(null)

    expect(await manager.getValidAccessToken()).toBeNull()
    expect(refresh).not.toHaveBeenCalled()
  })

  // Scenario: token 有效 —— 距離過期超過 leeway，直接回傳
  it('token 還有效時直接回傳，不刷新', async () => {
    const { manager, refresh } = setup(validToken)

    expect(await manager.getValidAccessToken()).toBe(validToken)
    expect(refresh).not.toHaveBeenCalled()
  })

  // Scenario: leeway 內 —— 即將過期先刷新並寫回 storage
  it('token 在 leeway 內即將過期時先刷新', async () => {
    const { manager, storage, refresh } = setup(expiringToken)
    refresh.mockResolvedValue(freshToken)

    expect(await manager.getValidAccessToken()).toBe(freshToken)
    expect(storage.get()).toBe(freshToken)
  })

  // Scenario: leeway 邊界 —— 剛好等於 leeway 視為快過期，多 1 秒則仍有效
  it('距離過期剛好 30 秒會刷新，31 秒不刷新', async () => {
    const boundary = setup(makeToken(NOW_SEC + 30, 'boundary'))
    boundary.refresh.mockResolvedValue(freshToken)
    expect(await boundary.manager.getValidAccessToken()).toBe(freshToken)

    const safe = setup(makeToken(NOW_SEC + 31, 'safe'))
    await safe.manager.getValidAccessToken()
    expect(safe.refresh).not.toHaveBeenCalled()
  })

  // Scenario: 壞掉的 JWT —— 讀不到 exp 視為快過期
  it('無法解析 exp 的 token 視為快過期，會刷新', async () => {
    const { manager, refresh } = setup('not-a-jwt')
    refresh.mockResolvedValue(freshToken)

    expect(await manager.getValidAccessToken()).toBe(freshToken)
    expect(refresh).toHaveBeenCalledTimes(1)
  })
})

describe('tokenManager：single-flight refresh', () => {
  // Scenario: single-flight —— 並行請求共用同一次刷新
  it('3 個請求同時遇到過期 token，只刷新 1 次，而且 3 個都拿到新 token', async () => {
    const { manager, storage, refresh } = setup(expiredToken)
    const pending = createDeferred<string>()
    refresh.mockReturnValue(pending.promise)
    const results = Promise.all([
      manager.getValidAccessToken(),
      manager.getValidAccessToken(),
      manager.getValidAccessToken(),
    ])
    pending.resolve(freshToken)
    expect(await results).toEqual([freshToken, freshToken, freshToken])
    expect(refresh).toHaveBeenCalledTimes(1)
    expect(storage.get()).toBe(freshToken)
  })

  // Scenario: 刷新進行中 —— getValidAccessToken 直接共用進行中的刷新
  it('刷新進行中呼叫 getValidAccessToken：共用同一次刷新', async () => {
    const { manager, refresh } = setup(expiredToken)
    const pending = createDeferred<string>()
    refresh.mockReturnValue(pending.promise)

    const first = manager.refresh()
    const second = manager.getValidAccessToken()
    pending.resolve(freshToken)

    expect(await Promise.all([first, second])).toEqual([freshToken, freshToken])
    expect(refresh).toHaveBeenCalledTimes(1)
  })

  // Scenario: 刷新結束 —— inFlight 清掉後可再次刷新
  it('刷新結束後可以再次刷新（inFlight 會被清掉）', async () => {
    const { manager, refresh } = setup(expiredToken)
    refresh.mockResolvedValueOnce(freshToken)
    await manager.refresh()

    const secondToken = makeToken(NOW_SEC + 7200, 'second')
    refresh.mockResolvedValueOnce(secondToken)

    expect(await manager.refresh()).toBe(secondToken)
    expect(refresh).toHaveBeenCalledTimes(2)
  })

  // Scenario: 刷新失敗 —— 等待中的請求一起失敗，之後可重試
  it('刷新失敗時所有等待中的請求一起失敗，之後可重試', async () => {
    const { manager, refresh } = setup(expiredToken)
    const failure = new Error('network down')
    refresh.mockRejectedValueOnce(failure)

    const results = await Promise.allSettled([
      manager.getValidAccessToken(),
      manager.getValidAccessToken(),
    ])

    expect(results.map((r) => r.status)).toEqual(['rejected', 'rejected'])
    expect(refresh).toHaveBeenCalledTimes(1)

    refresh.mockResolvedValueOnce(freshToken)
    expect(await manager.refresh()).toBe(freshToken)
  })
})

describe('tokenManager：session 失效', () => {
  // Scenario: refresh 401 —— session 失效，清除 token 並通知一次
  it('refresh 回 401：清除 token 並通知 onAuthExpired 一次', async () => {
    const { manager, storage, refresh, onAuthExpired } = setup(expiredToken)
    refresh.mockRejectedValue(createHttpError(401))

    await expect(manager.refresh()).rejects.toBeInstanceOf(AxiosError)

    expect(storage.get()).toBeNull()
    expect(onAuthExpired).toHaveBeenCalledTimes(1)
  })

  // Scenario: refresh 網路錯誤 —— 非 401/403 不算失效，保留登入
  it('refresh 因網路錯誤失敗（非 401/403）：保留登入狀態，不通知', async () => {
    const { manager, storage, refresh, onAuthExpired } = setup(expiredToken)
    refresh.mockRejectedValue(new Error('network down'))

    await expect(manager.refresh()).rejects.toThrow('network down')

    expect(storage.get()).toBe(expiredToken)
    expect(onAuthExpired).not.toHaveBeenCalled()
  })

  // Scenario: 刷新期間重新登入 —— 不覆蓋新 token
  it('刷新期間被重新登入換了 token：回傳新登入的 token，不覆蓋', async () => {
    const { manager, storage, refresh } = setup(expiredToken)
    const pending = createDeferred<string>()
    refresh.mockReturnValue(pending.promise)

    const result = manager.refresh()
    const reLoginToken = makeToken(NOW_SEC + 9999, 'relogin')
    storage.set(reLoginToken)
    pending.resolve(freshToken)

    expect(await result).toBe(reLoginToken)
    expect(storage.get()).toBe(reLoginToken)
  })

  // Scenario: 刷新期間登出 —— 捨棄結果，不寫回
  it('刷新期間已登出：捨棄刷新結果，不寫回 token', async () => {
    const { manager, storage, refresh } = setup(expiredToken)
    const pending = createDeferred<string>()
    refresh.mockReturnValue(pending.promise)

    const result = manager.refresh()
    manager.clearAuth()
    pending.resolve(freshToken)

    await expect(result).rejects.toThrow('刷新期間已登出')
    expect(storage.get()).toBeNull()
  })

  // Scenario: refresh 403 —— 與 401 同樣視為 session 失效
  it('refresh 回 403：清除 token 並通知 onAuthExpired 一次', async () => {
    const { manager, storage, refresh, onAuthExpired } = setup(expiredToken)
    refresh.mockRejectedValue(createHttpError(403))

    await expect(manager.refresh()).rejects.toBeInstanceOf(AxiosError)

    expect(storage.get()).toBeNull()
    expect(onAuthExpired).toHaveBeenCalledTimes(1)
  })

  // Scenario: refresh 401 但 token 已被換掉 —— 失效的是舊 session，不可清掉新登入
  it('refresh 回 401 時 token 已被重新登入換掉：不清除、不通知', async () => {
    const { manager, storage, refresh, onAuthExpired } = setup(expiredToken)
    const pending = createDeferred<string>()
    refresh.mockReturnValue(pending.promise)

    const result = manager.refresh()
    storage.set(validToken)
    pending.reject(createHttpError(401))

    await expect(result).rejects.toBeInstanceOf(AxiosError)
    expect(storage.get()).toBe(validToken)
    expect(onAuthExpired).not.toHaveBeenCalled()
  })

  // Scenario: expireSession 已登入 —— 清除 token 並通知 onAuthExpired 一次
  it('expireSession：已登入時清除 token 並通知一次', () => {
    const { manager, storage, onAuthExpired } = setup(validToken)

    manager.expireSession()

    expect(storage.get()).toBeNull()
    expect(onAuthExpired).toHaveBeenCalledTimes(1)
  })

  // Scenario: clearAuth —— 一般登出只清除 token，不觸發 onAuthExpired
  it('clearAuth：清除 token，不通知 onAuthExpired', () => {
    const { manager, storage, onAuthExpired } = setup(validToken)

    manager.clearAuth()

    expect(storage.get()).toBeNull()
    expect(onAuthExpired).not.toHaveBeenCalled()
  })

  // Scenario: expireSession 未登入 —— 不通知
  it('expireSession：原本沒登入就不通知 onAuthExpired', () => {
    const { manager, onAuthExpired } = setup(null)

    manager.expireSession()

    expect(onAuthExpired).not.toHaveBeenCalled()
  })

  // Scenario: setOnAuthExpired —— 可換掉處理函式，null 則停用
  it('setOnAuthExpired 可以換掉處理函式，傳 null 則停用', () => {
    const { manager, onAuthExpired } = setup(validToken)
    const another = vi.fn<() => void>()

    manager.setOnAuthExpired(another)
    manager.expireSession()

    expect(another).toHaveBeenCalledTimes(1)
    expect(onAuthExpired).not.toHaveBeenCalled()

    manager.setAccessToken(validToken)
    manager.setOnAuthExpired(null)
    expect(() => manager.expireSession()).not.toThrow()
    expect(another).toHaveBeenCalledTimes(1)
  })
})

describe('tokenManager：refreshAfterUnauthorized', () => {
  // Scenario: 401 時 token 已換新 —— 回傳目前 token，不再刷新
  it('送出後 token 已被別的請求換新：直接回傳目前的 token，不再刷新', async () => {
    const { manager, refresh } = setup(freshToken)

    expect(await manager.refreshAfterUnauthorized(expiredToken)).toBe(freshToken)
    expect(refresh).not.toHaveBeenCalled()
  })

  // Scenario: 401 時 token 沒變 —— 刷新並回傳新 token
  it('token 沒變：刷新並回傳新 token', async () => {
    const { manager, refresh } = setup(expiredToken)
    refresh.mockResolvedValue(freshToken)

    expect(await manager.refreshAfterUnauthorized(expiredToken)).toBe(freshToken)
  })

  // Scenario: 401 刷新失敗 —— 回 null，由呼叫端回拋 401
  it('刷新失敗：回傳 null，由呼叫端回拋原本的 401', async () => {
    const { manager, refresh } = setup(expiredToken)
    refresh.mockRejectedValue(createHttpError(401))

    expect(await manager.refreshAfterUnauthorized(expiredToken)).toBeNull()
  })
})

describe('tokenManager：setAccessToken', () => {
  // Scenario: setAccessToken(token) —— 寫入 storage 並通知訂閱者
  it('傳入 token 會寫入並通知訂閱者', () => {
    const { manager, storage } = setup(null)
    const listener = vi.fn<() => void>()
    manager.subscribe(listener)

    manager.setAccessToken(validToken)

    expect(storage.get()).toBe(validToken)
    expect(manager.getAccessToken()).toBe(validToken)
    expect(listener).toHaveBeenCalledTimes(1)
  })

  // Scenario: setAccessToken(null) —— 清除 token
  it('傳 null 會清除 token', () => {
    const { manager, storage } = setup(validToken)

    manager.setAccessToken(null)

    expect(storage.get()).toBeNull()
    expect(manager.getAccessToken()).toBeNull()
  })
})

describe('tokenManager：subscribe', () => {
  // Scenario: 訂閱 —— 刷新成功、clearAuth 都會通知；取消訂閱後不再通知
  it('token 變化會通知訂閱者，取消訂閱後不再通知', async () => {
    const { manager, refresh } = setup(expiredToken)
    refresh.mockResolvedValue(freshToken)
    const listener = vi.fn<() => void>()
    const unsubscribe = manager.subscribe(listener)

    await manager.refresh()
    expect(listener).toHaveBeenCalledTimes(1)

    manager.clearAuth()
    expect(listener).toHaveBeenCalledTimes(2)

    unsubscribe()
    manager.clearAuth()
    expect(listener).toHaveBeenCalledTimes(2)
  })
})

describe('createLocalTokenStorage', () => {
  // Scenario: localStorage 可用 —— 以指定 key 讀寫
  it('localStorage 可用時以指定 key 讀寫', () => {
    const store = new Map<string, string>()
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => store.set(key, value),
      removeItem: (key: string) => store.delete(key),
    })

    try {
      const storage = createLocalTokenStorage('test-key')

      storage.set('abc')
      expect(store.get('test-key')).toBe('abc')
      expect(storage.get()).toBe('abc')

      storage.remove()
      expect(store.has('test-key')).toBe(false)
      expect(storage.get()).toBeNull()
    } finally {
      vi.unstubAllGlobals()
    }
  })

  // Scenario: localStorage 不可用 —— 退回記憶體
  it('localStorage 不可用時退回記憶體', () => {
    const throwing = () => {
      throw new Error('storage disabled')
    }
    vi.stubGlobal('localStorage', {
      getItem: throwing,
      setItem: throwing,
      removeItem: throwing,
    })

    try {
      const storage = createLocalTokenStorage('test-key')

      expect(storage.get()).toBeNull()
      storage.set('abc')
      expect(storage.get()).toBe('abc')
      storage.remove()
      expect(storage.get()).toBeNull()
    } finally {
      vi.unstubAllGlobals()
    }
  })
})
