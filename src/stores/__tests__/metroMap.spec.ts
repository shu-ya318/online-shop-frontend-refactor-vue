import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Pinia } from 'pinia'

import { useMetroMapStore } from '@/stores/metroMap'
import { getAllStationOption, getMetroMap, getOriginDestinationDetails } from '@/services/metro'
import { ApiError } from '@/services/errors'
import type {
  GetMetroMapResponse,
  GetOriginDestinationDetailsRequest,
  GetOriginDestinationDetailsResponse,
  MetroMapStation,
  StationOption,
} from '@/services/metro/interface'
import { createDeferred, createTestPinia, releaseTestPinia } from '@/test/testUtils'

vi.mock('@/services/metro')

const makeStation = (stationCode: string, sequence = 1): MetroMapStation => ({
  stationCode,
  stationId: sequence,
  nameZhTw: stationCode,
  nameEn: stationCode,
  sequence,
})

const makeMetroMap = (): GetMetroMapResponse => ({
  lines: [
    {
      letter: 'R',
      color: '#ff0000',
      nameZhTw: '淡水信義線',
      nameEn: 'Tamsui-Xinyi Line',
      stations: [makeStation('R10', 1), makeStation('R11', 2)],
    },
    {
      letter: 'BL',
      color: '#0000ff',
      nameZhTw: '板南線',
      nameEn: 'Bannan Line',
      // R10 為轉乘站，會同時出現在兩條路線
      stations: [makeStation('R10', 1), makeStation('BL12', 2)],
    },
  ],
})

const makeRequest = (toStationCode: string): GetOriginDestinationDetailsRequest => ({
  fromStationCode: 'R10',
  toStationCode,
  fareType: 1,
  routingStrategy: 1,
})

const makeRoute = (toStationCode: string): GetOriginDestinationDetailsResponse => ({
  fromStationCode: 'R10',
  toStationCode,
  fareType: 1,
  routingStrategy: 1,
  route: [],
  transferCount: 0,
  totalTravelTimeSeconds: 600,
  transferTimeSeconds: 0,
  farePrice: 20,
})

const makeOptions = (): StationOption[] => [
  { stationCode: 'R10', nameZhTw: '台北車站', lineColor: '#ff0000' },
]

const networkError = () => new ApiError({ kind: 'network', status: 0, message: '網路連線異常' })

describe('useMetroMapStore', () => {
  let pinia: Pinia

  beforeEach(() => {
    vi.mocked(getMetroMap).mockReset()
    vi.mocked(getAllStationOption).mockReset()
    vi.mocked(getOriginDestinationDetails).mockReset()
    pinia = createTestPinia()
  })

  afterEach(() => {
    releaseTestPinia(pinia)
  })

  // Scenario: 共用請求 —— 多個元件同時需要路網圖，只能打一次 API
  describe('fetchMetroMap', () => {
    it('同時呼叫 8 次只打 1 次 API，完成後已有資料不再打', async () => {
      const deferred = createDeferred<GetMetroMapResponse>()
      vi.mocked(getMetroMap).mockReturnValue(deferred.promise)
      const metroMap = useMetroMapStore()
      const calls = Array.from({ length: 8 }, () => metroMap.fetchMetroMap())
      deferred.resolve(makeMetroMap())
      await Promise.all(calls)
      expect(getMetroMap).toHaveBeenCalledTimes(1)
      expect(metroMap.lines).toHaveLength(2)
      expect(metroMap.isMetroMapLoading).toBe(false)

      await metroMap.fetchMetroMap()
      expect(getMetroMap).toHaveBeenCalledTimes(1)
    })

    // Scenario: 車站去重 —— 轉乘站出現在多條路線，只留第一次出現的
    it('stations 去重：轉乘站只出現一次', async () => {
      vi.mocked(getMetroMap).mockResolvedValue(makeMetroMap())
      const metroMap = useMetroMapStore()
      await metroMap.fetchMetroMap()
      expect(metroMap.stations.map((station) => station.stationCode)).toEqual([
        'R10',
        'R11',
        'BL12',
      ])
    })

    // Scenario: 失敗重試 —— 不 reject，失敗後不能把失敗的 Promise 永遠留著
    it('失敗不 reject，錯誤放在 metroMapError，下次呼叫會重新抓', async () => {
      const error = networkError()
      vi.mocked(getMetroMap).mockRejectedValueOnce(error).mockResolvedValueOnce(makeMetroMap())
      const metroMap = useMetroMapStore()
      await expect(metroMap.fetchMetroMap()).resolves.toBeUndefined()
      expect(metroMap.metroMapError).toBe(error)
      expect(metroMap.lines).toEqual([])
      expect(metroMap.isMetroMapLoading).toBe(false)

      await metroMap.fetchMetroMap()
      expect(getMetroMap).toHaveBeenCalledTimes(2)
      expect(metroMap.metroMapError).toBeNull()
      expect(metroMap.lines).toHaveLength(2)
    })
  })

  // Scenario: 只採用最後一次 —— 先查 A→B 再查 A→C，A→B 晚到不能蓋掉 A→C
  describe('fetchRoute', () => {
    it('只採用最後一次查詢的結果', async () => {
      const first = createDeferred<GetOriginDestinationDetailsResponse>()
      const second = createDeferred<GetOriginDestinationDetailsResponse>()
      vi.mocked(getOriginDestinationDetails)
        .mockReturnValueOnce(first.promise)
        .mockReturnValueOnce(second.promise)
      const metroMap = useMetroMapStore()
      const a = metroMap.fetchRoute(makeRequest('BL12'))
      const b = metroMap.fetchRoute(makeRequest('R11'))
      second.resolve(makeRoute('R11'))
      await b
      first.resolve(makeRoute('BL12'))
      await a
      expect(metroMap.routeResult?.toStationCode).toBe('R11')
      expect(metroMap.isRouteLoading).toBe(false)
    })

    // Scenario: 開始時清空 —— 查新路線時不顯示舊結果，失敗時也不留舊結果
    it('失敗不 reject，清掉舊結果並寫入 routeError', async () => {
      vi.mocked(getOriginDestinationDetails).mockResolvedValueOnce(makeRoute('BL12'))
      const metroMap = useMetroMapStore()
      await metroMap.fetchRoute(makeRequest('BL12'))
      expect(metroMap.routeResult).not.toBeNull()

      const error = networkError()
      vi.mocked(getOriginDestinationDetails).mockRejectedValueOnce(error)
      await expect(metroMap.fetchRoute(makeRequest('R11'))).resolves.toBeUndefined()
      expect(metroMap.routeResult).toBeNull()
      expect(metroMap.routeError).toBe(error)
    })
  })

  // Scenario: 作廢進行中的查詢 —— clearRoute 後晚到的結果與錯誤都不能寫入
  describe('clearRoute', () => {
    it('進行中的查詢回來後不寫入結果', async () => {
      const deferred = createDeferred<GetOriginDestinationDetailsResponse>()
      vi.mocked(getOriginDestinationDetails).mockReturnValue(deferred.promise)
      const metroMap = useMetroMapStore()
      const pending = metroMap.fetchRoute(makeRequest('BL12'))
      metroMap.clearRoute()
      expect(metroMap.isRouteLoading).toBe(false)
      deferred.resolve(makeRoute('BL12'))
      await pending
      expect(metroMap.routeResult).toBeNull()
    })

    it('進行中的查詢失敗回來後不寫入錯誤', async () => {
      const deferred = createDeferred<GetOriginDestinationDetailsResponse>()
      vi.mocked(getOriginDestinationDetails).mockReturnValue(deferred.promise)
      const metroMap = useMetroMapStore()
      const pending = metroMap.fetchRoute(makeRequest('BL12'))
      metroMap.clearRoute()
      deferred.reject(networkError())
      await pending
      expect(metroMap.routeError).toBeNull()
      expect(metroMap.isRouteLoading).toBe(false)
    })
  })

  // Scenario: 車站選項 —— 已有資料不重抓，force 才強制重抓；失敗不 reject
  describe('fetchAllStationOption', () => {
    it('已有資料不再打；force 強制重抓', async () => {
      vi.mocked(getAllStationOption).mockResolvedValue(makeOptions())
      const metroMap = useMetroMapStore()
      await metroMap.fetchAllStationOption()
      await metroMap.fetchAllStationOption()
      expect(getAllStationOption).toHaveBeenCalledTimes(1)

      await metroMap.fetchAllStationOption(true)
      expect(getAllStationOption).toHaveBeenCalledTimes(2)
      expect(metroMap.stationOptions).toEqual(makeOptions())
    })

    it('失敗不 reject，訊息放在 stationOptionsError，重試成功後清掉', async () => {
      vi.mocked(getAllStationOption)
        .mockRejectedValueOnce(networkError())
        .mockResolvedValueOnce(makeOptions())
      const metroMap = useMetroMapStore()
      await expect(metroMap.fetchAllStationOption()).resolves.toBeUndefined()
      expect(metroMap.stationOptionsError).toBe('網路連線異常')
      expect(metroMap.isStationOptionsLoading).toBe(false)

      await metroMap.fetchAllStationOption()
      expect(metroMap.stationOptionsError).toBeNull()
      expect(metroMap.stationOptions).toHaveLength(1)
    })
  })
})
