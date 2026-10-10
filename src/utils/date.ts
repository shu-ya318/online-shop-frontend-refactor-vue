import { format, isValid, parseISO } from 'date-fns'
import { tz } from '@date-fns/tz'

const DISPLAY_TIME_ZONE = 'Asia/Taipei'
// 字串尾端已有 Z 或 ±hh:mm / ±hhmm 時區標示
const HAS_ZONE_PATTERN = /(Z|[+-]\d{2}(:?\d{2})?)$/i

export const parseServerDateTime = (value: string | null | undefined): Date | null => {
  if (!value) {
    return null
  }

  // 後端時間一律視為 UTC；沒有時區標示時補上 Z，避免被當成本地時間
  const normalized = HAS_ZONE_PATTERN.test(value) ? value : `${value}Z`
  const parsed = parseISO(normalized)

  return isValid(parsed) ? parsed : null
}
/**
 * 將後端的 UTC 時間轉成台北時間顯示（YYYY-MM-DD HH:mm）。
 * 沒有值或格式錯誤時回傳 fallback（預設空字串，與 React 版相同）；
 * 想顯示 '-' 時寫 formatDateTime(value, '-')，不要寫 `formatDateTime(value) ?? '-'`
 * （React 版 UserPermissionPage 這樣寫，'' 不是 null，'-' 永遠不會出現）。
 */
export const formatDateTime = (value: string | null | undefined, fallback = ''): string => {
  const parsed = parseServerDateTime(value)

  return parsed ? format(parsed, 'yyyy-MM-dd HH:mm', { in: tz(DISPLAY_TIME_ZONE) }) : fallback
}
