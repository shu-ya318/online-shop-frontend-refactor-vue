import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Pinia } from 'pinia'

import { useStationStore } from '@/stores/station'
import { getStationByCode } from '@/services/metro'
import { ApiError } from '@/services/errors'
import { StationFacility } from '@/services/metro/types'
import type { StationDetail } from '@/services/metro/interface'
import { createDeferred, createTestPinia, releaseTestPinia } from '@/test/testUtils'

vi.mock('@/services/metro')

const makeStationDetail = (overrides: Partial<StationDetail> = {}): StationDetail => ({
  id: 1,
  nameZhTw: '台北車站',
  nameEn: 'Taipei Main Station',
  atm: null,
  nursingRoom: null,
  diaperTable: null,
  chargingStation: null,
  ticketMachine: null,
  drinkingWater: null,
  restroom: null,
  elevator: null,
  escalator: null,
  updatedAt: '2026-01-01T00:00:00',
  ...overrides,
})

const serverError = (message: string) => new ApiError({ kind: 'server', status: 500, message })

describe('useStationStore', () => {
  let pinia: Pinia

  beforeEach(() => {
    vi.mocked(getStationByCode).mockReset()
    pinia = createTestPinia()
  })

  afterEach(() => {
    releaseTestPinia(pinia)
  })

  // Scenario: 只採用最後一次 —— 快速切換車站，先送出的請求晚到不能蓋掉後選的車站
  describe('selectStation', () => {
    it('快速切換車站：只採用最後一次的結果', async () => {
      const first = createDeferred<StationDetail>()
      const second = createDeferred<StationDetail>()
      vi.mocked(getStationByCode)
        .mockReturnValueOnce(first.promise)
        .mockReturnValueOnce(second.promise)
      const station = useStationStore()
      const a = station.selectStation('R10')
      const b = station.selectStation('BL12')
      second.resolve(makeStationDetail({ id: 2, nameZhTw: '板橋' }))
      await b
      first.resolve(makeStationDetail({ id: 1, nameZhTw: '台北車站' }))
      await a
      expect(station.currentStationCode).toBe('BL12')
      expect(station.stationDetail?.nameZhTw).toBe('板橋')
      expect(station.isStationLoading).toBe(false)
    })

    // Scenario: 錯誤不串台 —— A 的錯誤晚到，B 的畫面不能出現 A 的錯誤
    it('A 的錯誤晚到：不會出現在 B 的狀態', async () => {
      const first = createDeferred<StationDetail>()
      vi.mocked(getStationByCode)
        .mockReturnValueOnce(first.promise)
        .mockResolvedValueOnce(makeStationDetail({ id: 2 }))
      const station = useStationStore()
      const a = station.selectStation('R10')
      await station.selectStation('BL12')
      first.reject(serverError('A 站失敗'))
      await a
      expect(station.stationError).toBeNull()
      expect(station.stationDetail?.id).toBe(2)
      expect(station.isStationLoading).toBe(false)
    })

    // Scenario: 開始時清空 —— 查新車站時不顯示上一站的資料
    it('開始查詢時清掉上一站的資料與錯誤，並進入載入中', async () => {
      vi.mocked(getStationByCode).mockResolvedValueOnce(makeStationDetail())
      const station = useStationStore()
      await station.selectStation('R10')
      expect(station.stationDetail).not.toBeNull()

      const deferred = createDeferred<StationDetail>()
      vi.mocked(getStationByCode).mockReturnValueOnce(deferred.promise)
      const pending = station.selectStation('BL12')
      expect(station.currentStationCode).toBe('BL12')
      expect(station.stationDetail).toBeNull()
      expect(station.stationError).toBeNull()
      expect(station.isStationLoading).toBe(true)
      deferred.resolve(makeStationDetail({ id: 2 }))
      await pending
    })

    // Scenario: 錯誤可讀 —— 不 reject，失敗寫進 stationError
    it('查詢失敗不 reject，錯誤放在 stationError', async () => {
      const error = serverError('伺服器錯誤')
      vi.mocked(getStationByCode).mockRejectedValueOnce(error)
      const station = useStationStore()
      await expect(station.selectStation('R10')).resolves.toBeUndefined()
      expect(station.stationError).toBe(error)
      expect(station.stationDetail).toBeNull()
      expect(station.isStationLoading).toBe(false)
    })

    it('非 ApiError 的例外也會轉成 ApiError', async () => {
      vi.mocked(getStationByCode).mockRejectedValueOnce(new TypeError('壞掉了'))
      const station = useStationStore()
      await station.selectStation('R10')
      expect(station.stationError).toBeInstanceOf(ApiError)
      expect(station.stationError?.kind).toBe('unknown')
    })
  })

  // Scenario: 設施篩選只在 store —— 查詢參數帶的是送出當下的複本
  describe('設施篩選', () => {
    it('沒有篩選不帶 stationFacilities；有篩選帶複本，之後改篩選不影響已送出的參數', async () => {
      const station = useStationStore()
      vi.mocked(getStationByCode).mockResolvedValue(makeStationDetail())
      await station.selectStation('R10')
      expect(getStationByCode).toHaveBeenLastCalledWith({ stationCode: 'R10' })

      station.toggleFacility(StationFacility.ELEVATOR)
      station.toggleFacility(StationFacility.ATM)
      await station.selectStation('R10')
      const request = vi.mocked(getStationByCode).mock.lastCall?.[0]
      expect(request?.stationFacilities).toEqual([StationFacility.ELEVATOR, StationFacility.ATM])

      station.toggleFacility(StationFacility.ELEVATOR)
      expect(station.selectedFacilities).toEqual([StationFacility.ATM])
      expect(request?.stationFacilities).toEqual([StationFacility.ELEVATOR, StationFacility.ATM])

      station.setSelectedFacilities([StationFacility.RESTROOM])
      expect(station.selectedFacilities).toEqual([StationFacility.RESTROOM])
    })
  })

  // Scenario: 取消選取 —— clearSelection 讓進行中的查詢作廢
  describe('clearSelection', () => {
    it('清空狀態，進行中的查詢回來後不寫入', async () => {
      const deferred = createDeferred<StationDetail>()
      vi.mocked(getStationByCode).mockReturnValueOnce(deferred.promise)
      const station = useStationStore()
      const pending = station.selectStation('R10')
      station.clearSelection()
      expect(station.isStationLoading).toBe(false)
      deferred.resolve(makeStationDetail())
      await pending
      expect(station.currentStationCode).toBeNull()
      expect(station.stationDetail).toBeNull()
      expect(station.stationError).toBeNull()
    })
  })
})
