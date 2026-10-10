import { post } from '../http'

import type { ApiResponse } from '../common/interface'
import type { StationFareSyncStatus } from './interface'

const LONG_RUNNING_TIMEOUT_MS = 15 * 60 * 1000
const SYNC_REQUEST_CONFIG = { timeout: LONG_RUNNING_TIMEOUT_MS }

export const syncAllLine = async (): Promise<ApiResponse> => {
  return await post<ApiResponse>('/metro/sync/sync-all-line', undefined, SYNC_REQUEST_CONFIG)
}

export const syncAllLineTransfer = async (): Promise<ApiResponse> => {
  return await post<ApiResponse>('/metro/sync/sync-all-line-transfer')
}

export const syncAllStation = async (): Promise<ApiResponse> => {
  return await post<ApiResponse>('/metro/sync/sync-all-station')
}

export const syncAllLineStation = async (): Promise<ApiResponse> => {
  return await post<ApiResponse>('/metro/sync/sync-all-line-station')
}

export const syncAllLineStationCumulativeTime = async (): Promise<ApiResponse> => {
  return await post<ApiResponse>('/metro/sync/sync-all-line-station-cumulative-time')
}

// 觸發背景同步票價資料，立即回 202；不再需要 15 分鐘逾時。支援 AbortSignal 以便斷線/登出時中止。
export const syncAllStationFare = async (signal?: AbortSignal): Promise<ApiResponse> => {
  return await post<ApiResponse>('/metro/sync/sync-all-station-fare', {}, { signal })
}

// 查詢票價背景同步的當前狀態與進度，供前端輪詢。支援 AbortSignal。
export const getStationFareSyncStatus = async (
  signal?: AbortSignal,
): Promise<StationFareSyncStatus> => {
  return await post<StationFareSyncStatus>(
    '/metro/sync/sync-all-station-fare/status',
    {},
    { signal },
  )
}
