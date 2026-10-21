// @vitest-environment node
import { describe, expect, it } from 'vitest'

import {
  allocateMinutes,
  buildRouteChunkMinutes,
  formatTravelTime,
  normalizeHexColor,
} from '@/utils/route'

const sum = (values: number[]) => values.reduce((total, value) => total + value, 0)

describe('normalizeHexColor', () => {
  it('沒有 # 時補上 #', () => {
    expect(normalizeHexColor('E3002C')).toBe('#E3002C')
  })

  it('已有 # 時維持原樣，不重複補', () => {
    expect(normalizeHexColor('#E3002C')).toBe('#E3002C')
  })

  it('空字串補成單一 #', () => {
    expect(normalizeHexColor('')).toBe('#')
  })
})

describe('formatTravelTime', () => {
  it.each([
    [0, '0 分鐘'],
    [1, '1 分鐘'],
    [59, '1 分鐘'],
    [60, '1 分鐘'],
    [61, '2 分鐘'],
    [299, '5 分鐘'],
    [300, '5 分鐘'],
    [301, '6 分鐘'],
  ])('%i 秒 → %s（無條件進位）', (seconds, expected) => {
    expect(formatTravelTime(seconds)).toBe(expected)
  })
})

describe('allocateMinutes（最大餘數法）', () => {
  it('空陣列回傳空陣列', () => {
    expect(allocateMinutes([], 0)).toEqual([])
    expect(allocateMinutes([], 100)).toEqual([])
  })

  it('每段剛好整分鐘時不需要補分鐘', () => {
    expect(allocateMinutes([60, 120], 180)).toEqual([1, 2])
  })

  it('單一區段：進位成總車程分鐘', () => {
    expect(allocateMinutes([100], 100)).toEqual([2])
  })

  it('小數部分最大的區段優先補 1 分鐘', () => {
    // 原始分鐘 0.833、1.167、1.333；捨去後 [0,1,1]，缺 2 分鐘 → 補給小數最大的 idx0、idx2
    const minutes = allocateMinutes([50, 70, 80], 200)
    expect(minutes).toEqual([1, 1, 2])
    expect(sum(minutes)).toBe(4)
  })

  it('小數部分相同時，依原本順序先補前面的區段', () => {
    // 原始分鐘皆 1.5；總 270 秒 → 5 分鐘；捨去後 [1,1,1]，缺 2 → 補給 idx0、idx1
    expect(allocateMinutes([90, 90, 90], 270)).toEqual([2, 2, 1])
  })

  it('各段都是 61 秒、總車程 183 秒：加總為 4，而不是各自進位的 6', () => {
    const minutes = allocateMinutes([61, 61, 61], 183)
    expect(minutes).toEqual([2, 1, 1])
    expect(sum(minutes)).toBe(Math.ceil(183 / 60))
  })

  it('回傳長度與順序和輸入一致', () => {
    expect(allocateMinutes([10, 20, 30, 40], 100)).toHaveLength(4)
  })

  it('各段捨去後已超過總分鐘（缺額為負）時不調整，直接回傳捨去結果', () => {
    expect(allocateMinutes([120, 120], 60)).toEqual([2, 2])
  })
})

describe('buildRouteChunkMinutes', () => {
  it('沒有區段時回傳空陣列', () => {
    expect(buildRouteChunkMinutes([], 0, 0)).toEqual([])
  })

  it('單一區段沒有轉乘點，轉乘秒數不納入', () => {
    expect(buildRouteChunkMinutes([120], 600, 120)).toEqual([2])
  })

  it('兩段一個轉乘：依序為區段、轉乘、區段', () => {
    expect(buildRouteChunkMinutes([120, 120], 180, 420)).toEqual([2, 3, 2])
  })

  it('n 段共 2n - 1 塊（區段與轉乘交錯）', () => {
    expect(buildRouteChunkMinutes([60, 60, 60, 60], 0, 240)).toHaveLength(7)
  })

  it('轉乘總秒數平均分給每個轉乘點', () => {
    // 3 段 → 2 個轉乘點，各 60 秒；每一塊都是 1 分鐘
    expect(buildRouteChunkMinutes([60, 60, 60], 120, 300)).toEqual([1, 1, 1, 1, 1])
  })

  it('轉乘分攤後有小數時，依最大餘數法補分鐘', () => {
    // 區塊秒數 [60, 30, 60]，總 150 秒 → 3 分鐘；轉乘 0.5 分鐘為最大小數 → 補 1
    expect(buildRouteChunkMinutes([60, 60], 30, 150)).toEqual([1, 1, 1])
  })

  it('3 段各 61 秒、無轉乘時間：各自進位會是 6，分配後加總剛好 4', () => {
    const segments = [61, 61, 61]
    const naive = segments.map((seconds) => Math.ceil(seconds / 60))
    expect(sum(naive)).toBe(6)

    const minutes = buildRouteChunkMinutes(segments, 0, 183)
    // 交錯排列：區段、轉乘（0 秒）、區段、轉乘（0 秒）、區段
    expect(minutes).toHaveLength(5)
    expect(sum(minutes)).toBe(Math.ceil(183 / 60))
    expect(minutes).toEqual([2, 0, 1, 0, 1])
  })

  it('區段與轉乘秒數加總等於總車程時，分鐘加總等於總車程分鐘', () => {
    const segments = [95, 130, 47]
    const transfer = 200
    const total = sum(segments) + transfer
    expect(sum(buildRouteChunkMinutes(segments, transfer, total))).toBe(Math.ceil(total / 60))
  })
})
