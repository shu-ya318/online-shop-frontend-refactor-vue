// @vitest-environment node
import { describe, it, expect } from 'vitest'

import { formatDateTime, parseServerDateTime } from '@/utils/date'

describe('parseServerDateTime', () => {
  // Scenario: 空值 —— null / undefined / 空字串
  it.each([null, undefined, ''])('值為 %j 時回傳 null', (value) => {
    expect(parseServerDateTime(value)).toBeNull()
  })

  // Scenario: 不帶時區 —— 後端慣例格式，補 Z 視為 UTC
  it('無時區標示時視為 UTC', () => {
    expect(parseServerDateTime('2024-01-01T00:00:00')?.toISOString()).toBe(
      '2024-01-01T00:00:00.000Z',
    )
  })

  // Scenario: 小數秒 —— 不帶時區且含毫秒
  it('無時區標示且帶毫秒時視為 UTC', () => {
    expect(parseServerDateTime('2024-01-01T00:00:00.123')?.toISOString()).toBe(
      '2024-01-01T00:00:00.123Z',
    )
  })

  // Scenario: 帶 Z / 帶偏移 —— 且各格式都指向同一時間點（UTC 2024-01-01 00:00）
  it.each([
    ['Z', '2024-01-01T00:00:00Z'],
    ['+08:00', '2024-01-01T08:00:00+08:00'],
    ['+0800', '2024-01-01T08:00:00+0800'],
    ['+08', '2024-01-01T08:00:00+08'],
    ['-05:00', '2023-12-31T19:00:00-05:00'],
  ])('已有時區標示（%s）時不重複補 Z，依標示換算', (_label, value) => {
    expect(parseServerDateTime(value)?.toISOString()).toBe('2024-01-01T00:00:00.000Z')
  })

  // Scenario: 格式錯誤 —— 非日期字串、月日超出範圍、不存在的日期
  it.each(['abc', '2024-13-45T00:00:00', '2024-02-30T00:00:00'])(
    '格式錯誤或日期不存在（%s）時回傳 null',
    (value) => {
      expect(parseServerDateTime(value)).toBeNull()
    },
  )
})

describe('formatDateTime', () => {
  // Scenario: 不帶時區 —— UTC 轉台北（+8 小時）
  it('無時區的 UTC 時間轉成台北時間（+8 小時）', () => {
    expect(formatDateTime('2024-01-01T00:00:00')).toBe('2024-01-01 08:00')
  })

  // Scenario: 跨日 —— 邊界前後各一筆（16:00 剛跨、15:59:59 未跨）
  it('UTC 16:00 跨日：台北已是隔天 00:00', () => {
    expect(formatDateTime('2024-01-01T16:00:00')).toBe('2024-01-02 00:00')
  })

  it('UTC 15:59:59 尚未跨日：台北 23:59', () => {
    expect(formatDateTime('2024-01-01T15:59:59')).toBe('2024-01-01 23:59')
  })

  // Scenario: 跨日 —— 跨年、跨月與閏年
  it('跨年：UTC 12/31 16:30 → 台北隔年 01/01 00:30', () => {
    expect(formatDateTime('2023-12-31T16:30:00')).toBe('2024-01-01 00:30')
  })

  it('跨月與閏年：UTC 2/28 16:00 → 台北 2/29 00:00', () => {
    expect(formatDateTime('2024-02-28T16:00:00')).toBe('2024-02-29 00:00')
  })

  // Scenario: 帶 Z / 帶偏移 —— 與不帶時區的結果一致（同一時間點）
  it('有 Z 標示時同樣轉成台北時間', () => {
    expect(formatDateTime('2024-01-01T00:00:00Z')).toBe('2024-01-01 08:00')
  })

  it('有 +08:00 標示時顯示原本的台北時間', () => {
    expect(formatDateTime('2024-01-01T08:00:00+08:00')).toBe('2024-01-01 08:00')
  })

  it('有其他時區標示時換算成台北時間', () => {
    expect(formatDateTime('2024-01-01T00:00:00-05:00')).toBe('2024-01-01 13:00')
  })

  // Scenario: 輸出格式 —— 只到分鐘，秒數捨去
  it('秒數不顯示（只到分鐘）', () => {
    expect(formatDateTime('2024-01-01T00:00:59')).toBe('2024-01-01 08:00')
  })

  // Scenario: 空值 —— 未傳 fallback 時預設空字串
  it.each([null, undefined, ''])('值為 %j 時預設回傳空字串', (value) => {
    expect(formatDateTime(value)).toBe('')
  })

  // Scenario: fallback —— 空值、格式錯誤時使用；有值時忽略
  it('沒有值時回傳指定的 fallback', () => {
    expect(formatDateTime(null, '-')).toBe('-')
  })

  it('格式錯誤時回傳指定的 fallback', () => {
    expect(formatDateTime('abc', '-')).toBe('-')
  })

  it('有值時忽略 fallback', () => {
    expect(formatDateTime('2024-01-01T00:00:00', '-')).toBe('2024-01-01 08:00')
  })
})
