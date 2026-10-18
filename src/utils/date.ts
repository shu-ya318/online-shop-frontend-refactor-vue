import { format, isValid, parseISO } from 'date-fns'
import { tz } from '@date-fns/tz'

/** 畫面顯示用的時區 */
const DISPLAY_TIME_ZONE = 'Asia/Taipei'
/** 判斷字串尾端是否已有時區標示（`Z`、`+08:00`、`+0800`） */
const HAS_ZONE_PATTERN = /(Z|[+-]\d{2}(:?\d{2})?)$/i

/**
 * 把後端時間字串轉成 Date
 *
 * 後端時間一律是 UTC，沒有時區標示時會補上 `Z`，避免被當成本地時間。
 *
 * 可能沒有值的情形（依後端 DB 設定）：
 * - 軟刪除欄位 `deleted_at` 允許 NULL，未刪除時為空（書籤、行程、聊天訊息、公告）
 * - 後端序列化時省略 null 欄位，前端會讀到 `undefined`
 * - 後端傳回非日期的字串，解析後無效
 *
 * 常見使用情境：需要「計算或比較」時間，而非直接顯示。
 * - 判斷是否已刪除：`parseServerDateTime(item.deletedAt) !== null`
 * - 排序或比較先後：`parseServerDateTime(a.updatedAt)?.getTime()`
 * - 計算距今多久（相對時間）
 * @param value 後端時間字串
 * @returns Date；沒有值或格式錯誤時回傳 `null`
 */
export const parseServerDateTime = (value: string | null | undefined): Date | null => {
  if (!value) {
    return null
  }

  const normalized = HAS_ZONE_PATTERN.test(value) ? value : `${value}Z`
  const parsed = parseISO(normalized)

  return isValid(parsed) ? parsed : null
}

/**
 * 把後端的 UTC 時間轉成台北時間顯示
 *
 * 常見使用情境：直接把時間顯示在畫面上（模板內呼叫即可）。
 * - 聊天訊息時間：`{{ formatDateTime(message.createdAt) }}`
 * - 行程、公告的建立 / 更新時間：`{{ formatDateTime(plan.updatedAt) }}`
 * - 可能沒值的欄位（如 `deletedAt`）：`formatDateTime(item.deletedAt, '-')`
 *
 * 想顯示 `-` 必須傳第二個參數 `formatDateTime(value, '-')`，不要寫 `formatDateTime(value) ?? '-'`。
 * @param value 後端時間字串
 * @param fallback 沒有值或格式錯誤時的顯示文字，預設空字串
 * @returns 格式為 `yyyy-MM-dd HH:mm` 的台北時間
 */
export const formatDateTime = (value: string | null | undefined, fallback = ''): string => {
  const parsed = parseServerDateTime(value)

  return parsed ? format(parsed, 'yyyy-MM-dd HH:mm', { in: tz(DISPLAY_TIME_ZONE) }) : fallback
}
