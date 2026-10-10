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
  const onAuthExpired = vi.fn()
  const manager = createTokenManager({ refresh, storage, onAuthExpired, now: () => NOW_MS })

  return { manager, storage, refresh, onAuthExpired }
}

describe('readTokenExpiry', () => {
  it('回傳 exp 秒數', () => {
    expect(readTokenExpiry(validToken)).toBe(NOW_SEC + 3600)
  })

  it('非 JWT 或沒有 exp 時回傳 null', () => {
    expect(readTokenExpiry('not-a-jwt')).toBeNull()
    expect(readTokenExpiry(makeToken(undefined, 'no-exp'))).toBeNull()
  })
})

describe('tokenManager：getValidAccessToken', () => {
  it('沒有 token 時回傳 null，不刷新', async () => {
    const { manager, refresh } = setup(null)

    expect(await manager.getValidAccessToken()).toBeNull()
    expect(refresh).not.toHaveBeenCalled()
  })

  it('token 還有效時直接回傳，不刷新', async () => {
    const { manager, refresh } = setup(validToken)

    expect(await manager.getValidAccessToken()).toBe(validToken)
    expect(refresh).not.toHaveBeenCalled()
  })

  it('token 在 leeway 內即將過期時先刷新', async () => {
    const { manager, storage, refresh } = setup(expiringToken)
    refresh.mockResolvedValue(freshToken)

    expect(await manager.getValidAccessToken()).toBe(freshToken)
    expect(storage.get()).toBe(freshToken)
  })

  it('無法解析 exp 的 token 視為快過期，會刷新', async () => {
    const { manager, refresh } = setup('not-a-jwt')
    refresh.mockResolvedValue(freshToken)

    expect(await manager.getValidAccessToken()).toBe(freshToken)
    expect(refresh).toHaveBeenCalledTimes(1)
  })
})

describe('tokenManager：single-flight refresh', () => {
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

  it('刷新結束後可以再次刷新（inFlight 會被清掉）', async () => {
    const { manager, refresh } = setup(expiredToken)
    refresh.mockResolvedValueOnce(freshToken)
    await manager.refresh()

    const secondToken = makeToken(NOW_SEC + 7200, 'second')
    refresh.mockResolvedValueOnce(secondToken)

    expect(await manager.refresh()).toBe(secondToken)
    expect(refresh).toHaveBeenCalledTimes(2)
  })

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
  it('refresh 回 401：清除 token 並通知 onAuthExpired 一次', async () => {
    const { manager, storage, refresh, onAuthExpired } = setup(expiredToken)
    refresh.mockRejectedValue(createHttpError(401))

    await expect(manager.refresh()).rejects.toBeInstanceOf(AxiosError)

    expect(storage.get()).toBeNull()
    expect(onAuthExpired).toHaveBeenCalledTimes(1)
  })

  it('refresh 因網路錯誤失敗（非 401/403）：保留登入狀態，不通知', async () => {
    const { manager, storage, refresh, onAuthExpired } = setup(expiredToken)
    refresh.mockRejectedValue(new Error('network down'))

    await expect(manager.refresh()).rejects.toThrow('network down')

    expect(storage.get()).toBe(expiredToken)
    expect(onAuthExpired).not.toHaveBeenCalled()
  })

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

  it('expireSession：原本沒登入就不通知 onAuthExpired', () => {
    const { manager, onAuthExpired } = setup(null)

    manager.expireSession()

    expect(onAuthExpired).not.toHaveBeenCalled()
  })

  it('setOnAuthExpired 可以換掉處理函式，傳 null 則停用', () => {
    const { manager, onAuthExpired } = setup(validToken)
    const another = vi.fn()

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
  it('送出後 token 已被別的請求換新：直接回傳目前的 token，不再刷新', async () => {
    const { manager, refresh } = setup(freshToken)

    expect(await manager.refreshAfterUnauthorized(expiredToken)).toBe(freshToken)
    expect(refresh).not.toHaveBeenCalled()
  })

  it('token 沒變：刷新並回傳新 token', async () => {
    const { manager, refresh } = setup(expiredToken)
    refresh.mockResolvedValue(freshToken)

    expect(await manager.refreshAfterUnauthorized(expiredToken)).toBe(freshToken)
  })

  it('刷新失敗：回傳 null，由呼叫端回拋原本的 401', async () => {
    const { manager, refresh } = setup(expiredToken)
    refresh.mockRejectedValue(createHttpError(401))

    expect(await manager.refreshAfterUnauthorized(expiredToken)).toBeNull()
  })
})

describe('tokenManager：setAccessToken', () => {
  it('傳 null 會清除 token', () => {
    const { manager, storage } = setup(validToken)

    manager.setAccessToken(null)

    expect(storage.get()).toBeNull()
    expect(manager.getAccessToken()).toBeNull()
  })
})

describe('createLocalTokenStorage', () => {
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
