export type StationFareSyncStatusType = 'IDLE' | 'RUNNING' | 'SUCCESS' | 'FAILED'

export interface StationFareSyncStatus {
  status: StationFareSyncStatusType
  progressPercentage: number
  message: string
  startedAt: string | null
  finishedAt: string | null
}
