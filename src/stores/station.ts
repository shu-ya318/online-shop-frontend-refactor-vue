import { ref, shallowRef } from 'vue'
import { defineStore } from 'pinia'

import { getStationByCode } from '@/services/metro'
import { asApiError } from '@/stores/helpers'

import type { ApiError } from '@/services/errors'
import type { GetStationByCodeRequest, StationDetail } from '@/services/metro/interface'
import type { StationFacility } from '@/services/metro/types'

/** 目前選取的車站、詳細資料與設施篩選 */
export const useStationStore = defineStore('station', () => {
  const currentStationCode = ref<string | null>(null)
  const stationDetail = shallowRef<StationDetail | null>(null)
  const isStationLoading = ref(false)
  const stationError = shallowRef<ApiError | null>(null)
  /** 設施篩選（地圖點站、單站查詢都會帶上）。畫面用 computed 或 storeToRefs 讀，不要另外存一份 */
  const selectedFacilities = ref<StationFacility[]>([])

  let latestRequestId = 0

  /**
   * 選取車站並查詢詳細資料。不會 reject：失敗時看 stationError。
   */
  const selectStation = async (stationCode: string): Promise<void> => {
    const requestId = ++latestRequestId
    const isLatest = () => requestId === latestRequestId

    currentStationCode.value = stationCode
    stationDetail.value = null
    stationError.value = null
    isStationLoading.value = true

    const request: GetStationByCodeRequest = { stationCode }
    if (selectedFacilities.value.length > 0) {
      // 複製一份：請求送出後使用者再改篩選，不會影響這次的參數
      request.stationFacilities = [...selectedFacilities.value]
    }

    try {
      const detail = await getStationByCode(request)
      if (isLatest()) {
        stationDetail.value = detail
      }
    } catch (error) {
      if (isLatest()) {
        stationError.value = asApiError(error)
      }
    } finally {
      if (isLatest()) {
        isStationLoading.value = false
      }
    }
  }

  /** 取消選取；進行中的查詢回來後也不會再寫入 */
  const clearSelection = () => {
    latestRequestId++
    currentStationCode.value = null
    stationDetail.value = null
    stationError.value = null
    isStationLoading.value = false
  }

  /** 切換單一設施的選取狀態 */
  const toggleFacility = (facility: StationFacility) => {
    selectedFacilities.value = selectedFacilities.value.includes(facility)
      ? selectedFacilities.value.filter((item) => item !== facility)
      : [...selectedFacilities.value, facility]
  }

  /** 設定設施篩選 */
  const setSelectedFacilities = (facilities: StationFacility[]) => {
    selectedFacilities.value = [...facilities]
  }

  return {
    currentStationCode,
    stationDetail,
    isStationLoading,
    stationError,
    selectedFacilities,
    selectStation,
    clearSelection,
    toggleFacility,
    setSelectedFacilities,
  }
})
