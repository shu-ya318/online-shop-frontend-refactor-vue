// @vitest-environment node
import { describe, it, expect } from 'vitest'

import { getSafeRedirect } from '@/router/redirect'

describe('getSafeRedirect', () => {
  // Scenario: 站內路徑 —— 原樣回傳 pathname + search + hash
  it.each([
    ['/', '/'],
    ['/metro-map', '/metro-map'],
    ['/station/12?tab=chat#top', '/station/12?tab=chat#top'],
  ])('站內路徑 %s 回傳 %s', (input, expected) => {
    expect(getSafeRedirect(input)).toBe(expected)
  })

  // Scenario: 外部網址 —— 絕對網址、協定相對網址都擋掉
  it.each([
    'https://evil.com',
    'http://evil.com/path',
    '//evil.com',
    '//evil.com/path',
    'evil.com',
  ])('外部網址 %s 回傳 null', (input) => {
    expect(getSafeRedirect(input)).toBeNull()
  })

  // Scenario: 反斜線 / tab / 換行 —— 瀏覽器解析時會被當成 //evil.com
  it.each(['/\\evil.com', '/\t/evil.com', '/\n/evil.com', '/\r/evil.com', '/a\u0000b'])(
    '含反斜線或控制字元 %j 回傳 null',
    (input) => {
      expect(getSafeRedirect(input)).toBeNull()
    },
  )

  // Scenario: /auth 底下 —— 避免登入完又導回登入頁
  it.each(['/auth', '/auth/login', '/auth/login?redirect=/home', '/auth/sign-up#x'])(
    '/auth 底下的 %s 回傳 null',
    (input) => {
      expect(getSafeRedirect(input)).toBeNull()
    },
  )

  it('名稱只是以 auth 開頭的站內頁不受影響', () => {
    expect(getSafeRedirect('/authors')).toBe('/authors')
  })

  // Scenario: 空值與多個值 —— undefined、null、空字串、陣列取第一個
  it.each([undefined, null, ''])('值為 %j 時回傳 null', (value) => {
    expect(getSafeRedirect(value)).toBeNull()
  })

  it('陣列取第一個元素判斷', () => {
    expect(getSafeRedirect(['/metro-map', 'https://evil.com'])).toBe('/metro-map')
    expect(getSafeRedirect(['https://evil.com', '/metro-map'])).toBeNull()
    expect(getSafeRedirect([])).toBeNull()
    expect(getSafeRedirect([null])).toBeNull()
  })
})
