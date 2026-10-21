// @vitest-environment node
import { describe, expect, it } from 'vitest'

import type { StationOption } from '@/services/metro/interface'
import { formatStationLabel } from '@/utils/station'

const buildStation = (overrides: Partial<StationOption> = {}): StationOption => ({
  stationCode: 'R10',
  nameZhTw: '台北車站',
  lineColor: 'E3002C',
  ...overrides,
})

describe('formatStationLabel', () => {
  it('組成「站名（站碼）」，使用全形括號', () => {
    expect(formatStationLabel(buildStation())).toBe('台北車站（R10）')
  })

  it('轉乘站的站碼原樣顯示', () => {
    expect(formatStationLabel(buildStation({ stationCode: 'BL12', nameZhTw: '板橋' }))).toBe(
      '板橋（BL12）',
    )
  })

  it('不受 lineColor 影響', () => {
    expect(formatStationLabel(buildStation({ lineColor: '#0070BD' }))).toBe('台北車站（R10）')
  })

  it('站名或站碼為空字串時仍照格式輸出', () => {
    expect(formatStationLabel(buildStation({ nameZhTw: '', stationCode: '' }))).toBe('（）')
  })
})
