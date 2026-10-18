// @vitest-environment node
import axios, { AxiosError, AxiosHeaders, CanceledError } from 'axios'
import { describe, it, expect } from 'vitest'

import {
  ApiError,
  getErrorMessage,
  isApiError,
  parseErrorBody,
  toApiError,
} from '@/services/errors'

const httpError = (status: number, data: unknown) =>
  new AxiosError('request failed', 'ERR_BAD_REQUEST', undefined, undefined, {
    status,
    statusText: '',
    headers: {},
    config: { headers: new AxiosHeaders() },
    data,
  })

const noResponseError = (code: string) => new AxiosError('no response', code)

describe('toApiError：HTTP 有回應', () => {
  // Scenario: 驗證 map —— 400 回 {欄位: 訊息}，轉成 fieldErrors，message 串起所有訊息
  it('驗證失敗的 {欄位: 訊息} map：轉成 fieldErrors，message 是所有訊息串起來', async () => {
    const body = { email: 'Email 格式不正確!', password: '密碼長度必須為 8-20 個字元!' }
    const error = await toApiError(httpError(400, body))
    expect(error).toBeInstanceOf(ApiError)
    expect(error).toBeInstanceOf(Error)
    expect(error.kind).toBe('http')
    expect(error.status).toBe(400)
    expect(error.fieldErrors).toEqual(body)
    expect(error.message).toBe('Email 格式不正確!、密碼長度必須為 8-20 個字元!')
  })

  // Scenario: { message } —— 後端回單一訊息，直接採用且沒有 fieldErrors
  it('{ message }：message 採用後端訊息，沒有 fieldErrors', async () => {
    const error = await toApiError(httpError(409, { message: '帳號已存在' }))
    expect(error.kind).toBe('http')
    expect(error.status).toBe(409)
    expect(error.message).toBe('帳號已存在')
    expect(error.fieldErrors).toBeUndefined()
  })

  // Scenario: Blob 錯誤 body —— responseType: 'blob' 時錯誤 body 也是 Blob，要先讀成文字再解析
  it('Blob 內含 JSON 的錯誤 body：讀出文字後解析 message', async () => {
    const blob = new Blob([JSON.stringify({ message: '檔案不存在' })], {
      type: 'application/json',
    })
    const error = await toApiError(httpError(404, blob))
    expect(error.status).toBe(404)
    expect(error.message).toBe('檔案不存在')
  })

  // Scenario: Blob 非 JSON —— Blob 內容不是 JSON，退回狀態碼預設訊息
  it('Blob 內容不是 JSON：退回狀態碼預設訊息', async () => {
    const error = await toApiError(httpError(404, new Blob(['not json'])))
    expect(error.message).toBe('找不到資料')
    expect(error.fieldErrors).toBeUndefined()
  })

  // Scenario: 任意欄位名稱 —— 欄位名稱不限定前端表單有的欄位，原樣保留在 fieldErrors
  it('map 含前端表單沒有的欄位：原樣保留在 fieldErrors', async () => {
    const body = { unknownField: '後端新增的欄位錯誤' }
    const error = await toApiError(httpError(400, body))
    expect(error.fieldErrors).toEqual(body)
    expect(error.message).toBe('後端新增的欄位錯誤')
  })

  // Scenario: HTML 錯誤頁 —— 反向代理（如 nginx）回 HTML，無法解析就用狀態碼預設訊息
  it('HTML 錯誤頁：不解析，用狀態碼預設訊息', async () => {
    const error = await toApiError(httpError(502, '<html><body>502 Bad Gateway</body></html>'))
    expect(error.kind).toBe('http')
    expect(error.status).toBe(502)
    expect(error.message).toBe('伺服器發生錯誤，請稍後再試')
    expect(error.fieldErrors).toBeUndefined()
  })

  // Scenario: 狀態碼預設訊息 —— body 沒有可用內容時，依狀態碼給固定文案
  it.each([
    [400, '請求內容有誤'],
    [401, '登入已失效，請重新登入'],
    [403, '沒有權限執行此操作'],
    [404, '找不到資料'],
    [409, '資料衝突，請重新整理後再試'],
    [500, '伺服器發生錯誤，請稍後再試'],
    [503, '伺服器發生錯誤，請稍後再試'],
    [418, '發生未預期的錯誤，請稍後再試'],
  ])('狀態碼 %i 且 body 為空：message 為「%s」', async (status, message) => {
    const error = await toApiError(httpError(status, undefined))
    expect(error.status).toBe(status)
    expect(error.message).toBe(message)
  })

  // Scenario: cause —— 保留原始 AxiosError 方便除錯
  it('cause 保留原始 AxiosError', async () => {
    const original = httpError(500, undefined)
    const error = await toApiError(original)
    expect(error.cause).toBe(original)
  })
})

describe('toApiError：沒有回應或非 HTTP 錯誤', () => {
  // Scenario: 逾時 —— ECONNABORTED / ETIMEDOUT 都視為逾時，status 為 0
  it.each(['ECONNABORTED', 'ETIMEDOUT'])('錯誤碼 %s：kind 為 timeout', async (code) => {
    const error = await toApiError(noResponseError(code))
    expect(error.kind).toBe('timeout')
    expect(error.status).toBe(0)
    expect(error.message).toBe('請求逾時，請稍後再試')
  })

  // Scenario: 網路錯誤 —— 沒有 response 且不是逾時
  it('無回應且非逾時：kind 為 network', async () => {
    const error = await toApiError(noResponseError('ERR_NETWORK'))
    expect(error.kind).toBe('network')
    expect(error.status).toBe(0)
    expect(error.message).toBe('網路連線異常，請檢查網路後再試')
  })

  // Scenario: 取消 —— CanceledError 也是 AxiosError，要先判斷為 canceled 而非 network
  it('請求被取消：kind 為 canceled', async () => {
    const error = await toApiError(new CanceledError('canceled'))
    expect(axios.isAxiosError(new CanceledError('canceled'))).toBe(true)
    expect(error.kind).toBe('canceled')
    expect(error.status).toBe(0)
    expect(error.message).toBe('請求已取消')
  })

  // Scenario: 非 axios 錯誤 —— 一般 Error、字串、null 等都轉成 unknown
  it.each([new Error('boom'), 'oops', null, undefined])(
    '非 axios 錯誤（%s）：kind 為 unknown',
    async (value) => {
      const error = await toApiError(value)
      expect(error.kind).toBe('unknown')
      expect(error.status).toBe(0)
      expect(error.message).toBe('發生未預期的錯誤，請稍後再試')
      expect(error.cause).toBe(value)
    },
  )

  // Scenario: 已是 ApiError —— 原樣回傳同一個實例，不重複包裝
  it('已經是 ApiError：原樣回傳', async () => {
    const original = new ApiError({ kind: 'http', status: 403, message: '沒有權限' })
    expect(await toApiError(original)).toBe(original)
  })
})

describe('parseErrorBody', () => {
  // Scenario: message 優先 —— 同時有 message 與其他字串欄位時，以 message 為準
  it('同時有 message 與其他欄位：只取 message', () => {
    expect(parseErrorBody({ message: '失敗', email: '格式錯誤' })).toEqual({ message: '失敗' })
  })

  // Scenario: JSON 字串 —— 字串 body 先嘗試當 JSON 解析
  it('JSON 字串：解析後取出 message', () => {
    expect(parseErrorBody('{"message":"字串內的訊息"}')).toEqual({ message: '字串內的訊息' })
  })

  // Scenario: 空白 message —— message 只有空白不算有效，退回檢查 map
  it('message 只有空白且無其他欄位：回傳空物件', () => {
    expect(parseErrorBody({ message: '   ' })).toEqual({})
  })

  // Scenario: map 含空白訊息 —— 串接時略過空白訊息，但 fieldErrors 保留原值
  it('map 中有空白訊息：message 略過空白，fieldErrors 保留原值', () => {
    expect(parseErrorBody({ a: '錯誤 A', b: '  ' })).toEqual({
      message: '錯誤 A',
      fieldErrors: { a: '錯誤 A', b: '  ' },
    })
  })

  // Scenario: map 全為空白 —— 沒有可顯示的訊息，回傳空物件
  it('map 全為空白訊息：回傳空物件', () => {
    expect(parseErrorBody({ a: ' ', b: '' })).toEqual({})
  })

  // Scenario: 值非字串 —— 只要有一個值不是字串就不當作驗證 map
  it('map 含非字串值：回傳空物件', () => {
    expect(parseErrorBody({ a: '錯誤', b: 1 })).toEqual({})
  })

  // Scenario: 無法解析 —— 空物件、陣列、非 JSON 字串、null、數字
  it.each([{}, [], ['a'], '<html></html>', '', null, undefined, 42])(
    '無法解析的 body（%j）：回傳空物件',
    (body) => {
      expect(parseErrorBody(body)).toEqual({})
    },
  )
})

describe('isApiError / getErrorMessage', () => {
  // Scenario: type guard —— 只有 ApiError 實例回傳 true
  it('isApiError：ApiError 為 true，一般 Error 與其他值為 false', () => {
    expect(isApiError(new ApiError({ kind: 'unknown', status: 0, message: 'x' }))).toBe(true)
    expect(isApiError(new Error('x'))).toBe(false)
    expect(isApiError(null)).toBe(false)
  })

  // Scenario: ApiError 訊息 —— 回傳其 message
  it('getErrorMessage：ApiError 回傳其 message', () => {
    const error = new ApiError({ kind: 'http', status: 404, message: '找不到資料' })
    expect(getErrorMessage(error)).toBe('找不到資料')
  })

  // Scenario: 非 ApiError —— 回傳預設或自訂 fallback，不外洩原始錯誤訊息
  it('getErrorMessage：非 ApiError 回傳 fallback', () => {
    expect(getErrorMessage(new Error('內部細節'))).toBe('發生未預期的錯誤，請稍後再試')
    expect(getErrorMessage('x', '自訂訊息')).toBe('自訂訊息')
  })
})
