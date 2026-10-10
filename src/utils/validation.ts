import { isAfter, isBefore, isValid, parse, startOfDay, subYears } from 'date-fns'

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

// 嚴格解析 yyyy-MM-dd：格式不符或日期不存在（如 2023-02-30）回傳 null
const parseStrictDate = (value: string): Date | null => {
  if (!DATE_PATTERN.test(value)) return null

  const parsed = parse(value, 'yyyy-MM-dd', new Date())

  return isValid(parsed) ? parsed : null
}

/**
 * 驗證是否為 yyyy-MM-dd 格式的真實日期（空值視為通過，是否必填由各表單決定）
 */
export const isValidDateFormat = (value: string) => {
  if (!value) return true

  return parseStrictDate(value) !== null
}

/**
 * 驗證是否為 09 開頭的 10 碼手機號碼
 *
 * 比後端嚴格（後端只檢查格式，不限定手機）：
 * 註冊 SignupDTO：^0\d{9}$（0 開頭 10 碼，市話也會過）
 * 修改手機 UpdateCellphoneDTO、忘記密碼 ForgetPasswordDTO：^0\d{8,9}$（0 開頭 9～10 碼）
 */
export const isValidCellphone = (value: string) => {
  return /^09\d{8}$/.test(value)
}

/**
 * 驗證出生日期是否為真實存在的日期，且不大於今日
 */
export const isValidBirthDate = (value: string) => {
  if (!value) return true

  const birthDate = parseStrictDate(value)

  return birthDate !== null && !isAfter(birthDate, startOfDay(new Date()))
}

// data URI 前綴（不分大小寫），如 data:image/png;base64,xxxx
const DATA_URI_PATTERN = /data:[\w.+-]+\/[\w.+-]+;base64,/i
// 連續 200 字元以上的 base64 字元序列，攔截未帶前綴的裸 base64
const LONG_BASE64_PATTERN = /[A-Za-z0-9+/=]{200,}/
// HTML 標籤，如 <img src=...>、<script>（不分大小寫）
const HTML_TAG_PATTERN = /<\s*(img|script|iframe|svg|object|embed)\b/i

// 驗證聊天內容是否僅為純文字
// 夾帶圖片 data URI、裸 base64 或 HTML 標籤時回傳 false。
export const isPlainTextChatContent = (value: string) => {
  return (
    !DATA_URI_PATTERN.test(value) &&
    !LONG_BASE64_PATTERN.test(value) &&
    !HTML_TAG_PATTERN.test(value)
  )
}

/**
 * 驗證出生日期換算年齡是否介於 6 歲（含）至 150 歲（含）之間
 *
 * 前端以「瀏覽器本地的今天」計算，後端 BirthDateRangeValidator 以「UTC 的今天」計算。
 * 台灣時間 00:00～08:00 之間 UTC 還是前一天，剛好滿 6 歲的生日前端會通過、後端會擋下（回 400 驗證 map）。
 */
export const isValidBirthDateRange = (value: string) => {
  if (!value) return true // 是否必填由各表單決定

  // 格式錯誤或不存在的日期一律不通過（原 dayjs 版 Invalid Date 會被誤判為通過）
  const birthDate = parseStrictDate(value)
  if (!birthDate) return false

  const today = startOfDay(new Date())

  return !isBefore(birthDate, subYears(today, 150)) && !isAfter(birthDate, subYears(today, 6))
}
