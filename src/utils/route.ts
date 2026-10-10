// 確保色碼字串帶有 # 前綴
export const normalizeHexColor = (raw: string): string => (raw.startsWith('#') ? raw : `#${raw}`)

// 無條件進入法，和北捷官方計算方式一致
export const formatTravelTime = (seconds: number): string => `${Math.ceil(seconds / 60)} 分鐘`

// 最大餘數法：各區段各自無條件進位會和車程時間 label（總秒數無條件進位）加總不一致，
// 改用此法依各區段實際秒數比例分配分鐘數，確保加總結果等於車程時間 label 的值
export const allocateMinutes = (secondsList: number[], totalSeconds: number): number[] => {
  const targetMinutes = Math.ceil(totalSeconds / 60)
  const rawMinutes = secondsList.map((seconds) => seconds / 60)
  const flooredMinutes = rawMinutes.map((minutes) => Math.floor(minutes))
  const remainder = targetMinutes - flooredMinutes.reduce((sum, minutes) => sum + minutes, 0)

  // 小數部分由大到小，前 remainder 個區段各多分配 1 分鐘
  const bumpedIndexes = new Set(
    rawMinutes
      .map((minutes, index) => ({ index, fraction: minutes - Math.floor(minutes) }))
      .sort((a, b) => b.fraction - a.fraction)
      .slice(0, Math.max(remainder, 0))
      .map(({ index }) => index),
  )
  return flooredMinutes.map((minutes, index) => (bumpedIndexes.has(index) ? minutes + 1 : minutes))
}

// 依序交錯排列「區段秒數、轉乘秒數、區段秒數、…」，轉乘總秒數平均分配到各轉乘點，
// 再以最大餘數法轉為分鐘數（偶數索引為區段、奇數索引為轉乘）
export const buildRouteChunkMinutes = (
  segmentsSeconds: number[],
  transferTimeSeconds: number,
  totalSeconds: number,
): number[] => {
  const transferGapCount = Math.max(segmentsSeconds.length - 1, 0)
  const transferSecondsPerGap = transferGapCount > 0 ? transferTimeSeconds / transferGapCount : 0

  const chunkSeconds: number[] = []
  segmentsSeconds.forEach((seconds, i) => {
    chunkSeconds.push(seconds)
    if (i < transferGapCount) chunkSeconds.push(transferSecondsPerGap)
  })

  return allocateMinutes(chunkSeconds, totalSeconds)
}
