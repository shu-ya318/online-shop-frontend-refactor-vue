import { isAfter, isBefore, isValid, parse, startOfDay, subYears } from 'date-fns'

/** yyyy-MM-dd 格式 */
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

/**
 * 嚴格解析 yyyy-MM-dd 日期
 * @param value 日期字串
 * @returns Date；格式不符或日期不存在（如： 2023-02-30）時回傳 `null`
 */
const parseStrictDate = (value: string): Date | null => {
  if (!DATE_PATTERN.test(value)) return null

  const parsed = parse(value, 'yyyy-MM-dd', new Date())

  return isValid(parsed) ? parsed : null
}

/**
 * 驗證是否為 yyyy-MM-dd 格式的真實日期
 *
 * 空值視為通過，是否必填由各表單決定。
 * @param value 日期字串
 */
export const isValidDateFormat = (value: string) => {
  if (!value) return true

  return parseStrictDate(value) !== null
}

/**
 * 驗證是否為 09 開頭的 10 碼手機號碼
 *
 * 比後端嚴格，後端只檢查格式，不限定手機：
 * - 註冊 SignupDTO：`^0\d{9}$`（0 開頭 10 碼，市話也會過）
 * - 修改手機 UpdateCellphoneDTO、忘記密碼 ForgetPasswordDTO：`^0\d{8,9}$`（0 開頭 9～10 碼）
 * @param value 手機號碼
 */
export const isValidCellphone = (value: string) => {
  return /^09\d{8}$/.test(value)
}

/**
 * 驗證出生日期是否為真實存在的日期，且不晚於今天
 *
 * 空值視為通過。
 * @param value 出生日期，格式 yyyy-MM-dd
 */
export const isValidBirthDate = (value: string) => {
  if (!value) return true

  const birthDate = parseStrictDate(value)

  return birthDate !== null && !isAfter(birthDate, startOfDay(new Date()))
}

/** 圖片 data URI 前綴，如 `data:image/png;base64,xxxx` */
const DATA_URI_PATTERN = /data:[\w.+-]+\/[\w.+-]+;base64,/i
/** 連續 200 字元以上的 base64 字元，用來擋沒有前綴的 base64 */
const LONG_BASE64_PATTERN = /[A-Za-z0-9+/=]{200,}/
/** 危險 HTML 標籤，如 `<img>`、`<script>` */
const HTML_TAG_PATTERN = /<\s*(img|script|iframe|svg|object|embed)\b/i

/**
 * 驗證聊天內容是否只有純文字
 * @param value 聊天內容
 * @returns 夾帶圖片 data URI、base64 或 HTML 標籤時回傳 `false`
 */
export const isPlainTextChatContent = (value: string) => {
  return (
    !DATA_URI_PATTERN.test(value) &&
    !LONG_BASE64_PATTERN.test(value) &&
    !HTML_TAG_PATTERN.test(value)
  )
}

/**
 * 驗證出生日期換算的年齡是否在 6 歲（含）到 150 歲（含）之間
 *
 * 空值視為通過。格式錯誤或不存在的日期不通過。
 *
 * 注意：前端用「瀏覽器本地的今天」，後端 BirthDateRangeValidator 用「UTC 的今天」。
 * 台灣時間 00:00～08:00 UTC 還是前一天，剛滿 6 歲的生日前端會通過、後端會擋下（回 400）。
 * @param value 出生日期，格式 yyyy-MM-dd
 */
export const isValidBirthDateRange = (value: string) => {
  if (!value) return true

  const birthDate = parseStrictDate(value)
  if (!birthDate) return false

  const today = startOfDay(new Date())

  return !isBefore(birthDate, subYears(today, 150)) && !isAfter(birthDate, subYears(today, 6))
}
