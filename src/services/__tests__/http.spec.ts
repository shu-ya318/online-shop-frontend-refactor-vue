// @vitest-environment node
import { AxiosError, type AxiosAdapter, type InternalAxiosRequestConfig } from 'axios'
import { describe, it, expect, vi } from 'vitest'

import { createHttpClient } from '@/services/http'

import type { TokenStorage } from '@/services/tokenManager'

const base64Url = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url')

// jwtDecode 只解碼不驗簽；預設 exp 設在一小時後，避免 request interceptor 觸發預先刷新
const makeToken = (tag: string, expOffsetSec = 3600) =>
  `${base64Url({ alg: 'none', typ: 'JWT' })}.${base64Url({
    exp: Math.floor(Date.now() / 1000) + expOffsetSec,
    tag,
  })}.sig`

const tokenA = makeToken('A')
const tokenB = makeToken('B')
const expiredToken = makeToken('expired', -60)

const bearer = (token: string) => `Bearer ${token}`
const REFRESH_URL = '/auth/refresh-tokens'

interface FakeResponse {
  status: number
  data?: unknown
}

/** 每次請求送出當下的快照；重送會沿用 config 物件，所以不能事後再讀 header */
interface RecordedCall {
  url: string
  method: string
  baseURL?: string
  timeout?: number
  data: unknown
  authorization?: string
  config: InternalAxiosRequestConfig
}

const createHttpError = (config: InternalAxiosRequestConfig, status: number, data: unknown) =>
  new AxiosError(
    `Request failed with status code ${status}`,
    status >= 500 ? AxiosError.ERR_BAD_RESPONSE : AxiosError.ERR_BAD_REQUEST,
    config,
    undefined,
    { status, statusText: '', headers: {}, config, data },
  )

/** respond 回傳假回應；要模擬網路錯誤、逾時就直接在 respond 內 throw */
const setup = (
  respond: (config: InternalAxiosRequestConfig) => FakeResponse,
  initialToken: string | null,
) => {
  let token = initialToken
  const storage: TokenStorage = {
    get: () => token,
    set: (value) => {
      token = value
    },
    remove: () => {
      token = null
    },
  }
  const onAuthExpired = vi.fn<() => void>()
  const calls: RecordedCall[] = []

  const adapter: AxiosAdapter = async (config) => {
    calls.push({
      url: config.url ?? '',
      method: config.method ?? '',
      baseURL: config.baseURL,
      timeout: config.timeout,
      data: config.data,
      authorization: config.headers.get('Authorization')?.toString(),
      config,
    })
    const { status, data = null } = respond(config)

    if (status >= 400) {
      throw createHttpError(config, status, data)
    }

    return { status, statusText: '', headers: {}, config, data }
  }

  const client = createHttpClient({ adapter, storage, onAuthExpired })
  const callsTo = (url: string) => calls.filter((call) => call.url === url)

  return { client, calls, callsTo, storage, onAuthExpired }
}

const authOf = (config: InternalAxiosRequestConfig) => config.headers.get('Authorization')

/** 刷新端點回新 token；其餘端點只有帶 `validToken` 才 200，否則 401 */
const respondWithRefresh =
  (validToken: string, newToken: string) =>
  (config: InternalAxiosRequestConfig): FakeResponse => {
    if (config.url === REFRESH_URL) {
      return { status: 200, data: { accessToken: newToken } }
    }

    return authOf(config) === bearer(validToken)
      ? { status: 200, data: { ok: true } }
      : { status: 401, data: { message: 'token 失效' } }
  }

describe('http：request', () => {
  // Scenario: POST 與 query string —— 回傳 response.data、帶 baseURL 與 body，query string 原樣保留
  it('post 回傳 response.data，並帶 baseURL、JSON body 與 query string', async () => {
    const { client, calls } = setup(() => ({ status: 200, data: { id: 1 } }), null)

    const result = await client.post<{ id: number }>('/station/search?keyword=abc', { page: 1 })

    expect(result).toEqual({ id: 1 })
    expect(calls).toHaveLength(1)
    expect(calls[0]).toMatchObject({
      url: '/station/search?keyword=abc',
      method: 'post',
      baseURL: '/api/v1',
    })
    expect(JSON.parse(String(calls[0]?.data))).toEqual({ page: 1 })
  })

  // Scenario: 逾時設定 —— 預設 10 秒，呼叫端可用 config 覆寫
  it('預設逾時 10 秒，呼叫端可以覆寫', async () => {
    const { client, calls } = setup(() => ({ status: 200 }), null)

    await client.post('/station/list')
    await client.post('/station/export', undefined, { timeout: 30000 })

    expect(calls.map((call) => call.timeout)).toEqual([10000, 30000])
  })

  // Scenario: 帶 token —— 一般 API 有 token 就帶 Bearer
  it('一般 API 有 token 時帶 Authorization: Bearer', async () => {
    const { client, calls } = setup(() => ({ status: 200 }), tokenA)

    await client.post('/user/profile')

    expect(calls[0]?.authorization).toBe(bearer(tokenA))
  })

  // Scenario: 公開 API —— 沒有 token 也能成功，不帶 Authorization，不刷新
  it('沒有 token 的公開 API 照樣成功，不帶 Authorization、不刷新', async () => {
    const { client, calls, callsTo } = setup(() => ({ status: 200, data: { stations: [] } }), null)

    await expect(client.post('/station/list')).resolves.toEqual({ stations: [] })

    expect(calls[0]?.authorization).toBeUndefined()
    expect(callsTo(REFRESH_URL)).toHaveLength(0)
  })
})

describe('http：auth 端點白名單', () => {
  // Scenario: 白名單不帶 token —— /auth/* 端點（含 query string）即使已登入也不帶 Authorization
  it('log-in 等 auth 端點不帶 Authorization，query string 不影響判斷', async () => {
    const { client, calls } = setup(() => ({ status: 200 }), tokenA)

    await client.post('/auth/log-in', { email: 'a@b.c', password: 'x' })
    await client.post('/auth/log-in?redirect=%2Fhome', { email: 'a@b.c', password: 'x' })

    expect(calls.map((call) => call.authorization)).toEqual([undefined, undefined])
  })

  // Scenario: log-out 帶 token —— 唯一例外，登出要讓後端知道是誰
  it('log-out 會帶 Authorization', async () => {
    const { client, calls } = setup(() => ({ status: 200 }), tokenA)

    await client.post('/auth/log-out')

    expect(calls[0]?.authorization).toBe(bearer(tokenA))
  })

  // Scenario: 登入密碼錯誤的 401 —— 屬於業務錯誤，不可刷新、不可重送、不登出
  it('log-in 回 401（帳密錯誤）不刷新、不重送、token 不變', async () => {
    const { client, callsTo, storage, onAuthExpired } = setup(
      () => ({ status: 401, data: { message: '帳號或密碼錯誤' } }),
      tokenA,
    )

    await expect(client.post('/auth/log-in', {})).rejects.toMatchObject({
      status: 401,
      message: '帳號或密碼錯誤',
    })

    expect(callsTo('/auth/log-in')).toHaveLength(1)
    expect(callsTo(REFRESH_URL)).toHaveLength(0)
    expect(storage.get()).toBe(tokenA)
    expect(onAuthExpired).not.toHaveBeenCalled()
  })

  // Scenario: update-password 的 401 —— 舊密碼錯誤是業務錯誤，不刷新、不登出，token 保留
  it('update-password 的 401（舊密碼錯誤）不刷新、不登出，token 保留', async () => {
    const { client, callsTo, storage, onAuthExpired } = setup(
      () => ({ status: 401, data: { message: '舊密碼錯誤!' } }),
      tokenA,
    )
    await expect(
      client.post('/user/update-password', { oldPassword: 'x', newPassword: 'y' }),
    ).rejects.toMatchObject({ status: 401, message: '舊密碼錯誤!' })
    expect(callsTo('/auth/refresh-tokens')).toHaveLength(0)
    expect(callsTo('/user/update-password')).toHaveLength(1)
    expect(storage.get()).toBe(tokenA)
    expect(onAuthExpired).not.toHaveBeenCalled()
  })
})

describe('http：401 刷新後重送', () => {
  // Scenario: 刷新後重送 —— 一般 API 回 401，刷新一次後用新 token 重送並成功
  it('401 後刷新一次，用新 token 重送並回傳結果', async () => {
    const { client, calls, callsTo, storage } = setup(respondWithRefresh(tokenB, tokenB), tokenA)

    await expect(client.post('/user/profile')).resolves.toEqual({ ok: true })

    expect(callsTo(REFRESH_URL)).toHaveLength(1)
    expect(callsTo('/user/profile').map((call) => call.authorization)).toEqual([
      bearer(tokenA),
      bearer(tokenB),
    ])
    expect(storage.get()).toBe(tokenB)
    expect(calls).toHaveLength(3)
  })

  // Scenario: 重送仍 401 —— 只重送一次（_retried），第二次 401 直接轉成 ApiError，不再刷新
  it('重送後仍 401 不再重試，轉成 ApiError', async () => {
    const { client, callsTo } = setup((config) => {
      if (config.url === REFRESH_URL) {
        return { status: 200, data: { accessToken: tokenB } }
      }

      return { status: 401, data: { message: '沒有權限' } }
    }, tokenA)

    await expect(client.post('/user/profile')).rejects.toMatchObject({
      kind: 'http',
      status: 401,
      message: '沒有權限',
    })

    expect(callsTo('/user/profile')).toHaveLength(2)
    expect(callsTo(REFRESH_URL)).toHaveLength(1)
  })

  // Scenario: 同時 401 —— 3 個請求都帶舊 token 收到 401，只刷新 1 次，3 個都用新 token 重送成功
  it('3 個請求同時 401，只刷新 1 次，全部重送成功', async () => {
    const { client, callsTo } = setup(respondWithRefresh(tokenB, tokenB), tokenA)

    const results = await Promise.all([
      client.post('/user/profile'),
      client.post('/user/bookmarks'),
      client.post('/user/trips'),
    ])

    expect(results).toEqual([{ ok: true }, { ok: true }, { ok: true }])
    expect(callsTo(REFRESH_URL)).toHaveLength(1)
  })

  // Scenario: 送出前已過期 —— 3 個請求同時送出，interceptor 先刷新一次，之後都帶新 token，不會收到 401
  it('token 送出前已過期：只刷新 1 次，3 個請求都帶新 token 且不會 401', async () => {
    const { client, calls, callsTo, storage } = setup(
      respondWithRefresh(tokenB, tokenB),
      expiredToken,
    )

    await Promise.all([
      client.post('/user/profile'),
      client.post('/user/bookmarks'),
      client.post('/user/trips'),
    ])

    expect(callsTo(REFRESH_URL)).toHaveLength(1)
    const apiCalls = calls.filter((call) => call.url !== REFRESH_URL)
    expect(apiCalls).toHaveLength(3)
    expect(apiCalls.every((call) => call.authorization === bearer(tokenB))).toBe(true)
    expect(storage.get()).toBe(tokenB)
  })

  // Scenario: 沒帶 token 的 401 —— 沒登入就收到 401，不刷新也不重送，直接轉成錯誤
  it('沒帶 token 收到 401：不刷新、不重送', async () => {
    const { client, callsTo, onAuthExpired } = setup(() => ({ status: 401 }), null)

    await expect(client.post('/user/profile')).rejects.toMatchObject({
      kind: 'http',
      status: 401,
      message: '登入已失效，請重新登入',
    })

    expect(callsTo('/user/profile')).toHaveLength(1)
    expect(callsTo(REFRESH_URL)).toHaveLength(0)
    expect(onAuthExpired).not.toHaveBeenCalled()
  })
})

describe('http：刷新失敗', () => {
  // Scenario: 刷新被拒 —— refresh 回 401，清除 token、只通知一次，並回拋原本的 401（不重送）
  it('refresh 被拒：清除 token、onAuthExpired 只通知一次、回拋原本的 401', async () => {
    const { client, callsTo, storage, onAuthExpired } = setup((config) => {
      if (config.url === REFRESH_URL) {
        return { status: 401, data: { message: 'refresh token 無效' } }
      }

      return { status: 401, data: { message: 'token 失效' } }
    }, tokenA)

    await expect(client.post('/user/profile')).rejects.toMatchObject({
      status: 401,
      message: 'token 失效',
    })

    expect(callsTo('/user/profile')).toHaveLength(1)
    expect(callsTo(REFRESH_URL)).toHaveLength(1)
    expect(storage.get()).toBeNull()
    expect(onAuthExpired).toHaveBeenCalledTimes(1)
  })

  // Scenario: 刷新被拒（並行）—— 多個請求同時遇到，仍只通知一次
  it('3 個請求同時遇到 refresh 被拒：onAuthExpired 仍只通知一次', async () => {
    const { client, storage, onAuthExpired } = setup(() => ({ status: 401 }), tokenA)

    const results = await Promise.allSettled([
      client.post('/user/profile'),
      client.post('/user/bookmarks'),
      client.post('/user/trips'),
    ])

    expect(results.map((result) => result.status)).toEqual(['rejected', 'rejected', 'rejected'])
    expect(storage.get()).toBeNull()
    expect(onAuthExpired).toHaveBeenCalledTimes(1)
  })

  // Scenario: 預先刷新遇網路錯誤 —— 請求改成不帶 token 送出，不會再觸發第二次刷新，登入狀態保留
  it('送出前刷新遇網路錯誤：改不帶 token 送出，不再刷新，登入狀態保留', async () => {
    const { client, callsTo, storage, onAuthExpired } = setup((config) => {
      if (config.url === REFRESH_URL) {
        throw new AxiosError('Network Error', AxiosError.ERR_NETWORK, config)
      }

      return { status: 401 }
    }, expiredToken)

    await expect(client.post('/user/profile')).rejects.toMatchObject({ status: 401 })

    expect(callsTo(REFRESH_URL)).toHaveLength(1)
    expect(callsTo('/user/profile')).toHaveLength(1)
    expect(callsTo('/user/profile')[0]?.authorization).toBeUndefined()
    expect(storage.get()).toBe(expiredToken)
    expect(onAuthExpired).not.toHaveBeenCalled()
  })
})

describe('http：錯誤轉換', () => {
  // Scenario: 403 —— 只轉成 ApiError，不刷新、不登出、不導頁
  it('403 轉成 ApiError，不刷新、不登出', async () => {
    const { client, callsTo, storage, onAuthExpired } = setup(
      () => ({ status: 403, data: { message: '沒有權限執行此操作' } }),
      tokenA,
    )

    await expect(client.post('/admin/users')).rejects.toMatchObject({
      kind: 'http',
      status: 403,
      message: '沒有權限執行此操作',
    })

    expect(callsTo(REFRESH_URL)).toHaveLength(0)
    expect(storage.get()).toBe(tokenA)
    expect(onAuthExpired).not.toHaveBeenCalled()
  })

  // Scenario: 5xx —— 後端沒給訊息時用狀態碼預設文案
  it('500 且 body 為空：使用預設的伺服器錯誤文案', async () => {
    const { client } = setup(() => ({ status: 500 }), null)

    await expect(client.post('/station/list')).rejects.toMatchObject({
      kind: 'http',
      status: 500,
      message: '伺服器發生錯誤，請稍後再試',
    })
  })

  // Scenario: 驗證 map —— 400 回 {欄位: 訊息}，ApiError 帶 fieldErrors
  it('400 驗證 map 轉成 fieldErrors', async () => {
    const { client } = setup(() => ({ status: 400, data: { email: '格式不正確' } }), null)

    await expect(client.post('/auth/sign-up', {})).rejects.toMatchObject({
      status: 400,
      message: '格式不正確',
      fieldErrors: { email: '格式不正確' },
    })
  })

  // Scenario: Blob 錯誤 body —— responseType: 'blob' 的錯誤也要解析出後端訊息
  it('responseType 為 blob 的錯誤，會讀出 Blob 內的訊息', async () => {
    const { client } = setup(
      () => ({
        status: 400,
        data: new Blob([JSON.stringify({ message: '匯出條件有誤' })]),
      }),
      tokenA,
    )

    await expect(
      client.post('/station/export', undefined, { responseType: 'blob' }),
    ).rejects.toMatchObject({ status: 400, message: '匯出條件有誤' })
  })

  // Scenario: 逾時 —— 沒有 response 且 code 為 ECONNABORTED，轉成 timeout
  it('逾時轉成 kind: timeout', async () => {
    const { client } = setup((config) => {
      throw new AxiosError('timeout of 10000ms exceeded', AxiosError.ECONNABORTED, config)
    }, null)

    await expect(client.post('/station/list')).rejects.toMatchObject({
      kind: 'timeout',
      status: 0,
      message: '請求逾時，請稍後再試',
    })
  })

  // Scenario: 網路錯誤 —— 沒有 response 且不是逾時，轉成 network
  it('網路不通轉成 kind: network', async () => {
    const { client } = setup((config) => {
      throw new AxiosError('Network Error', AxiosError.ERR_NETWORK, config)
    }, null)

    await expect(client.post('/station/list')).rejects.toMatchObject({
      kind: 'network',
      status: 0,
      message: '網路連線異常，請檢查網路後再試',
    })
  })
})
