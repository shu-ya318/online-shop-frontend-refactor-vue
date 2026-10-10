import { ref } from 'vue'
import { defineStore } from 'pinia'

import { getStationByCode } from '@/services/metro'
import { getErrorMessage } from '@/services/errors'

import { useMetroMapStore } from '@/stores/metroMapStore'

import type { StationDetail } from '@/services/metro/interface'

export const useStationStore = defineStore('station', () => {
  const metroMapStore = useMetroMapStore()

  const currentStationCode = ref<string | null>(null)
  const stationDetail = ref<StationDetail | null>(null)
  const isStationLoading = ref(false)
  const error = ref<string | null>(null)

  const selectAndFetchStation = async (stationCode: string) => {
    currentStationCode.value = stationCode
    isStationLoading.value = true
    error.value = null

    try {
      const { selectedFacilities } = metroMapStore
      stationDetail.value = await getStationByCode({
        stationCode,
        ...(selectedFacilities.length > 0 && { stationFacilities: selectedFacilities }),
      })
    } catch (e) {
      error.value = getErrorMessage(e)
    } finally {
      isStationLoading.value = false
    }
  }

  const clearSelection = () => {
    currentStationCode.value = null
    stationDetail.value = null
  }

  return {
    currentStationCode,
    stationDetail,
    isStationLoading,
    error,
    selectAndFetchStation,
    clearSelection,
  }
})
