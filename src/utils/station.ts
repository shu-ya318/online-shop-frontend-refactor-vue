import type { StationOption } from '@/services/metro/interface'

export const formatStationLabel = (station: StationOption): string =>
  `${station.nameZhTw}（${station.stationCode}）`
