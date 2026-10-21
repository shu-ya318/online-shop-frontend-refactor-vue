import type { StationOption } from '@/services/metro/interface'

/**
 * 組出站點顯示文字
 * @param station 站點選項
 * @returns 例如 `台北車站（R10）`
 */
export const formatStationLabel = (station: StationOption): string =>
  `${station.nameZhTw}（${station.stationCode}）`
