import { ref } from 'vue'
import { defineStore } from 'pinia'

import { getAllStationOption, getMetroMap, getOriginDestinationDetails } from '@/services/metro'
import { getErrorMessage } from '@/services/errors'

import type { StationFacility } from '@/services/metro/types'
import type {
  MetroMapLine,
  MetroMapStation,
  StationOption,
  GetOriginDestinationDetailsRequest,
  GetOriginDestinationDetailsResponse,
} from '@/services/metro/interface'

// store 不直接跳通知（尚未綁定 UI 套件）：失敗訊息放在 error / stationOptionsError / routeError，由畫面決定怎麼顯示
export const useMetroMapStore = defineStore('metroMap', () => {
  const lines = ref<MetroMapLine[]>([])
  const stations = ref<MetroMapStation[]>([])
  const stationOptions = ref<StationOption[]>([])
  const isStationOptionsLoading = ref(false)
  const isMetroMapLoading = ref(false)
  const error = ref<string | null>(null)
  const stationOptionsError = ref<string | null>(null)
  const routeResult = ref<GetOriginDestinationDetailsResponse | null>(null)
  const isRouteLoading = ref(false)
  const routeError = ref<string | null>(null)
  const selectedFacilities = ref<StationFacility[]>([])

  const fetchMetroMap = async () => {
    if (lines.value.length > 0) return

    isMetroMapLoading.value = true
    error.value = null

    try {
      const response = await getMetroMap()
      const seenStationCodes = new Set<string>()
      const uniqueStations: MetroMapStation[] = []

      for (const line of response.lines) {
        for (const station of line.stations) {
          if (!seenStationCodes.has(station.stationCode)) {
            seenStationCodes.add(station.stationCode)
            uniqueStations.push(station)
          }
        }
      }

      lines.value = response.lines
      stations.value = uniqueStations
    } catch (e) {
      error.value = getErrorMessage(e)
    } finally {
      isMetroMapLoading.value = false
    }
  }

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

  const fetchRoute = async (request: GetOriginDestinationDetailsRequest) => {
    isRouteLoading.value = true
    routeError.value = null

    try {
      routeResult.value = await getOriginDestinationDetails(request)
    } catch (e) {
      routeError.value = getErrorMessage(e, '路徑查詢失敗')
    } finally {
      isRouteLoading.value = false
    }
  }

  const clearRoute = () => {
    routeResult.value = null
    routeError.value = null
  }

  const setSelectedFacilities = (facilities: StationFacility[]) => {
    selectedFacilities.value = facilities
  }

  return {
    lines,
    stations,
    stationOptions,
    isStationOptionsLoading,
    isMetroMapLoading,
    error,
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
