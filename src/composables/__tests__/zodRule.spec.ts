import { describe, expect, it } from 'vitest'
import { z } from 'zod'

import { zodRule } from '@/composables/zodRule'

describe('zodRule', () => {
  const rule = zodRule(z.string().min(1, '必填').min(3, '至少 3 個字'))

  it('通過時回傳 null', () => {
    expect(rule('abc')).toBeNull()
  })

  it('沒通過時回傳第一個錯誤訊息', () => {
    expect(rule('')).toBe('必填')
    expect(rule('ab')).toBe('至少 3 個字')
  })

  it('schema 沒有自訂訊息時用 zod 的訊息，不會回傳空字串', () => {
    expect(zodRule(z.number())('abc')).toEqual(expect.any(String))
  })
})
