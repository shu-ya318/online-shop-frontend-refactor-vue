import { AxiosError } from 'axios'
import { it, expect } from 'vitest'

import { ApiError, toApiError } from '@/services/errors'

const httpError = (status: number, data: unknown) =>
  new AxiosError('request failed', 'ERR_BAD_REQUEST', undefined, undefined, {
    status,
    statusText: '',
    headers: {},
    config: {} as never,
    data,
  })

it('驗證失敗的 {欄位: 訊息} map：轉成 fieldErrors，message 是所有訊息串起來', async () => {
  const body = { email: 'Email 格式不正確!', password: '密碼長度必須為 8-20 個字元!' }
  const error = await toApiError(httpError(400, body))
  expect(error).toBeInstanceOf(ApiError)
  expect(error).toBeInstanceOf(Error)
  expect(error.kind).toBe('http')
  expect(error.status).toBe(400)
  expect(error.fieldErrors).toEqual(body)
  expect(error.message).toContain('Email 格式不正確!')
  expect(error.message).toContain('密碼長度必須為 8-20 個字元!')
  expect(error.message).not.toBe('unknown error')
})
