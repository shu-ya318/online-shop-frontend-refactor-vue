// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { ApiError } from '@/services/errors'
import { splitApiError } from '@/utils/formErrors'

const values = { email: '', password: '' }

describe('splitApiError', () => {
  it('欄位錯誤對得到表單欄位：放到 fieldErrors，沒有整體錯誤', () => {
    const error = new ApiError({
      kind: 'http',
      status: 400,
      message: '請求內容有誤',
      fieldErrors: { password: '密碼長度必須為 8-20 個字元!' },
    })
    expect(splitApiError(error, values)).toEqual({
      fieldErrors: { password: '密碼長度必須為 8-20 個字元!' },
      formError: null,
    })
  })

  it('對不到表單欄位的欄位錯誤：合併成整體錯誤，不會被丟掉', () => {
    const error = new ApiError({
      kind: 'http',
      status: 400,
      message: '請求內容有誤',
      fieldErrors: {
        email: 'Email 已被註冊',
        resetPasswordToken: 'token 不可為空',
        other: '其他錯誤',
      },
    })
    expect(splitApiError(error, values)).toEqual({
      fieldErrors: { email: 'Email 已被註冊' },
      formError: 'token 不可為空、其他錯誤',
    })
  })

  it('ApiError 沒有欄位錯誤：用它的 message 當整體錯誤', () => {
    const error = new ApiError({ kind: 'http', status: 401, message: '帳號或密碼錯誤!' })
    expect(splitApiError(error, values)).toEqual({
      fieldErrors: {},
      formError: '帳號或密碼錯誤!',
    })
  })

  it('不是 ApiError：顯示通用訊息，不外流內部錯誤內容', () => {
    expect(splitApiError(new Error('內部細節'), values)).toEqual({
      fieldErrors: {},
      formError: '發生未預期的錯誤，請稍後再試',
    })
  })
})
