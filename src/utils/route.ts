/**
 * 色碼沒有 # 開頭時補上 #
 * @param raw 色碼字串，例如 `E3002C` 或 `#E3002C`
 * @returns 一定帶 # 的色碼
 */
export const normalizeHexColor = (raw: string): string => (raw.startsWith('#') ? raw : `#${raw}`)

/**
 * 把秒數轉成「N 分鐘」，不足一分鐘也算一分鐘（無條件進位，與北捷官方算法一致）
 * @param seconds 車程秒數
 * @returns 例如 `5 分鐘`
 */
export const formatTravelTime = (seconds: number): string => `${Math.ceil(seconds / 60)} 分鐘`

/**
 * 把每段的秒數換成分鐘，並讓各段分鐘加總等於總車程分鐘
 *
 * 每段各自進位，加總會比總車程多，所以改用最大餘數法：
 * 先全部無條件捨去，缺的分鐘數再補給小數部分最大的幾段。
 * @param secondsList 各區段秒數
 * @param totalSeconds 總秒數，總分鐘為其無條件進位
 * @returns 各區段分鐘數，順序與 `secondsList` 相同
 */
export const allocateMinutes = (secondsList: number[], totalSeconds: number): number[] => {
  const targetMinutes = Math.ceil(totalSeconds / 60)
  const rawMinutes = secondsList.map((seconds) => seconds / 60)
  const flooredMinutes = rawMinutes.map((minutes) => Math.floor(minutes))
  const remainder = targetMinutes - flooredMinutes.reduce((sum, minutes) => sum + minutes, 0)

  const bumpedIndexes = new Set(
    rawMinutes
      .map((minutes, index) => ({ index, fraction: minutes - Math.floor(minutes) }))
      .sort((a, b) => b.fraction - a.fraction)
      .slice(0, Math.max(remainder, 0))
      .map(({ index }) => index),
  )
  return flooredMinutes.map((minutes, index) => (bumpedIndexes.has(index) ? minutes + 1 : minutes))
}

/**
 * 產生路線每一塊的分鐘數，依序為「區段、轉乘、區段、轉乘…」
 *
 * 轉乘總秒數平均分給每個轉乘點，所以偶數索引是區段，奇數索引是轉乘。
 * @param segmentsSeconds 各區段秒數
 * @param transferTimeSeconds 轉乘總秒數
 * @param totalSeconds 總車程秒數
 * @returns 每一塊的分鐘數，加總等於總車程分鐘
 */
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
