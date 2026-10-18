import { computed, ref, shallowRef } from 'vue'
import { defineStore } from 'pinia'

import { getAllStationOption, getMetroMap, getOriginDestinationDetails } from '@/services/metro'
import { getErrorMessage, toApiError, type ApiError } from '@/services/errors'

import type { StationFacility } from '@/services/metro/types'
import type {
  MetroMapLine,
  MetroMapStation,
  StationOption,
  GetOriginDestinationDetailsRequest,
  GetOriginDestinationDetailsResponse,
} from '@/services/metro/interface'

/** 各路線的車站去重（轉乘站會出現在多條路線，只留第一次出現的） */
const uniqueStations = (lines: MetroMapLine[]): MetroMapStation[] => {
  const seenStationCodes = new Set<string>()
  const result: MetroMapStation[] = []

  for (const line of lines) {
    for (const station of line.stations) {
      if (!seenStationCodes.has(station.stationCode)) {
        seenStationCodes.add(station.stationCode)
        result.push(station)
      }
    }
  }

  return result
}

/**
 * 路網圖、車站選項、起訖站路徑查詢與設施篩選。
 * 不直接跳通知：失敗訊息放在 metroMapError / stationOptionsError / routeError，由畫面決定怎麼顯示。
 */
export const useMetroMapStore = defineStore('metroMap', () => {
  // ===== 路網圖 =====
  const lines = shallowRef<MetroMapLine[]>([])
  const stations = computed(() => uniqueStations(lines.value))
  const isMetroMapLoading = ref(false)
  const metroMapError = shallowRef<ApiError | null>(null)
  let metroMapRequest: Promise<void> | null = null

  /** 實際載入路網圖，失敗寫入 metroMapError */
  const loadMetroMap = async (): Promise<void> => {
    isMetroMapLoading.value = true
    metroMapError.value = null

    try {
      const response = await getMetroMap()
      lines.value = response.lines
    } catch (error) {
      metroMapError.value = await toApiError(error)
    } finally {
      isMetroMapLoading.value = false
    }
  }

  /**
   * 載入路網圖（已經有資料就不再抓）。不會 reject：失敗時看 metroMapError。
   * React 版只用 lines.length 判斷，資料回來之前被呼叫幾次就打幾次 API。
   */
  const fetchMetroMap = (): Promise<void> => {
    if (lines.value.length > 0) {
      return Promise.resolve()
    }

    // single-flight：同時呼叫的人拿到同一個 Promise；結束後（成功或失敗）解除，失敗了可以再試
    metroMapRequest ??= loadMetroMap().finally(() => {
      metroMapRequest = null
    })
    return metroMapRequest
  }

  // ===== 車站選項 =====
  const stationOptions = ref<StationOption[]>([])
  const isStationOptionsLoading = ref(false)
  const stationOptionsError = ref<string | null>(null)

  /** 載入車站選項（已有資料就略過，force 強制重抓）。不會 reject：失敗看 stationOptionsError */
  const fetchAllStationOption = async (force = false) => {
    if (!force && stationOptions.value.length > 0) return

    isStationOptionsLoading.value = true
    stationOptionsError.value = null

    try {
      stationOptions.value = await getAllStationOption()
    } catch (e) {
      stationOptionsError.value = getErrorMessage(e, '取得車站選項失敗')
    } finally {
      isStationOptionsLoading.value = false
    }
  }

  // ===== 起訖站路徑查詢 =====
  const routeResult = shallowRef<GetOriginDestinationDetailsResponse | null>(null)
  const isRouteLoading = ref(false)
  const routeError = shallowRef<ApiError | null>(null)
  let latestRouteRequestId = 0

  /**
   * 查詢路徑。不會 reject：失敗時看 routeError。
   * 只採用最後一次查詢的結果：先查 A→B 再查 A→C，A→B 比較晚回來也不會蓋掉 A→C。
   * 開始時清掉上一次的結果，畫面不會在查新路線時還顯示舊路線（也避免失敗時舊結果留在畫面上）。
   */
  const fetchRoute = async (request: GetOriginDestinationDetailsRequest): Promise<void> => {
    const requestId = ++latestRouteRequestId
    const isLatest = () => requestId === latestRouteRequestId

    routeResult.value = null
    routeError.value = null
    isRouteLoading.value = true

    try {
      const response = await getOriginDestinationDetails(request)
      if (isLatest()) {
        routeResult.value = response
      }
    } catch (error) {
      const apiError = await toApiError(error)
      if (isLatest()) {
        routeError.value = apiError
      }
    } finally {
      if (isLatest()) {
        isRouteLoading.value = false
      }
    }
  }

  /** 清除路徑結果；進行中的查詢回來後也不會再寫入 */
  const clearRoute = () => {
    latestRouteRequestId++
    routeResult.value = null
    routeError.value = null
    isRouteLoading.value = false
  }

  // ===== 設施篩選 =====
  const selectedFacilities = ref<StationFacility[]>([])

  /** 設定設施篩選 */
  const setSelectedFacilities = (facilities: StationFacility[]) => {
    selectedFacilities.value = facilities
  }

  return {
    lines,
    stations,
    isMetroMapLoading,
    metroMapError,
    stationOptions,
    isStationOptionsLoading,
    stationOptionsError,
    routeResult,
    isRouteLoading,
    routeError,
    selectedFacilities,
    fetchMetroMap,
    fetchAllStationOption,
    fetchRoute,
    clearRoute,
    setSelectedFacilities,
  }
})
