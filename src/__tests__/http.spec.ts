import { AxiosError, type AxiosAdapter, type InternalAxiosRequestConfig } from 'axios'
import { it, expect, vi } from 'vitest'

import { createHttpClient } from '@/services/http'

import type { TokenStorage } from '@/services/tokenManager'

const base64Url = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url')

// jwtDecode 只解碼不驗簽；exp 設在一小時後，避免 request interceptor 觸發預先刷新
const makeToken = (tag: string) =>
  `${base64Url({ alg: 'none', typ: 'JWT' })}.${base64Url({
    exp: Math.floor(Date.now() / 1000) + 3600,
    tag,
  })}.sig`

const tokenA = makeToken('A')

interface FakeResponse {
  status: number
  data?: unknown
}

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
  const onAuthExpired = vi.fn()
  const calls: InternalAxiosRequestConfig[] = []

  const adapter: AxiosAdapter = async (config) => {
    calls.push(config)
    const { status, data = null } = respond(config)
    const response = { status, statusText: '', headers: {}, config, data }

    if (status >= 400) {
      throw new AxiosError(
        `Request failed with status code ${status}`,
        status >= 500 ? AxiosError.ERR_BAD_RESPONSE : AxiosError.ERR_BAD_REQUEST,
        config,
        undefined,
        response,
      )
    }

    return response
  }

  const client = createHttpClient({ adapter, storage, onAuthExpired })
  const callsTo = (url: string) => calls.filter((call) => call.url === url)

  return { client, callsTo, storage, onAuthExpired }
}

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
