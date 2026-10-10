import { describe, it, expect } from 'vitest'

import { buildRouteChunkMinutes } from '@/utils/route'

const sum = (values: number[]) => values.reduce((total, value) => total + value, 0)

describe('route：分鐘分配（最大餘數法）', () => {
  it('3 段各 61 秒：各自無條件進位會變成 6 分鐘，與總車程 4 分鐘不一致；分配後加總剛好 4', () => {
    const segments = [61, 61, 61]
    const naive = segments.map((seconds) => Math.ceil(seconds / 60))
    expect(sum(naive)).toBe(6)
    const minutes = buildRouteChunkMinutes(segments, 0, 183)
    // 交錯排列：區段、轉乘（0 秒）、區段、轉乘（0 秒）、區段
    expect(minutes).toHaveLength(5)
    expect(sum(minutes)).toBe(Math.ceil(183 / 60))
    expect(minutes).toEqual([2, 0, 1, 0, 1])
  })
})
