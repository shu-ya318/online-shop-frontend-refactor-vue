// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { zodRule } from '@/composables/zodRule'
import {
  confirmPasswordMatches,
  forgetPasswordSchema,
  loginSchema,
  resetPasswordSchema,
  signupSchema,
} from '@/schemas/auth'

/** 固定「今天」為 2024-06-15（本地時間，時區為 Asia/Taipei） */
beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date(2024, 5, 15, 12, 0, 0))
})
afterEach(() => {
  vi.useRealTimers()
})

describe('auth schemas', () => {
  it('email：空值與格式錯誤都顯示同一個訊息', () => {
    const rule = zodRule(loginSchema.shape.email)
    expect(rule('')).toBe('請輸入有效格式的電子郵件!')
    expect(rule('abc')).toBe('請輸入有效格式的電子郵件!')
    expect(rule('ming@example.com')).toBeNull()
  })

  it('密碼：空值提示必填，長度要 8-20', () => {
    const rule = zodRule(loginSchema.shape.password)
    expect(rule('')).toBe('請輸入密碼!')
    expect(rule('1234567')).toBe('密碼長度必須為 8-20 個字元!')
    expect(rule('a'.repeat(21))).toBe('密碼長度必須為 8-20 個字元!')
    expect(rule('12345678')).toBeNull()
  })

  it('手機：空值提示必填，必須 09 開頭 10 碼', () => {
    const rule = zodRule(forgetPasswordSchema.shape.cellphone)
    expect(rule('')).toBe('請輸入手機號碼!')
    expect(rule('0212345678')).toBe('請輸入 09 開頭的 10 碼手機號碼!')
    expect(rule('0912345678')).toBeNull()
  })

  it('出生日期：選填，有填才檢查格式、不晚於今天、年齡 6-150 歲', () => {
    const rule = zodRule(signupSchema.shape.birthDate)
    expect(rule('')).toBeNull()
    expect(rule(undefined)).toBeNull()
    expect(rule('2000/01/01')).toBe('出生日期格式必須為 yyyy-MM-dd!')
    expect(rule('2024-06-16')).toBe('出生日期必須有效且不得大於今日!')
    expect(rule('2020-01-01')).toBe('出生日期年齡必須介於 6 歲至 150 歲之間!')
    expect(rule('2000-01-01')).toBeNull()
  })

  it('重設密碼：新密碼 8-20 個字元、確認密碼必填', () => {
    expect(zodRule(resetPasswordSchema.shape.newPassword)('')).toBe('請輸入新密碼!')
    expect(zodRule(resetPasswordSchema.shape.newPassword)('123')).toBe(
      '密碼長度必須為 8-20 個字元!',
    )
    expect(zodRule(resetPasswordSchema.shape.confirmPassword)('')).toBe('請再次輸入新密碼!')
  })

  it('confirmPasswordMatches：和新密碼相同才通過', () => {
    expect(confirmPasswordMatches('password1', { newPassword: 'password1' })).toBeNull()
    expect(confirmPasswordMatches('password2', { newPassword: 'password1' })).toBe(
      '新密碼與確認密碼不符!',
    )
  })
})
