import { getErrorMessage, isApiError } from '@/services/errors'

/** key 是不是表單上的欄位（type guard，取代 `as keyof T`） */
const isFieldOf = <T extends object>(values: T, key: string): key is Extract<keyof T, string> =>
  key in values

/**
 * 把 API 錯誤拆成「欄位錯誤」與「整體錯誤」：
 * - 後端回傳的欄位錯誤（{欄位: 訊息}）對得到表單欄位的，放到該欄位下方
 * - 其他情況（沒有欄位錯誤、對不到欄位、不是 ApiError）合併成一段整體錯誤，顯示在送出按鈕上方
 *
 * @param error onSubmit 裡 catch 到的錯誤
 * @param values 表單的值，只用來判斷有哪些欄位
 */
export function splitApiError<T extends object>(
  error: unknown,
  values: T,
): { fieldErrors: Partial<Record<keyof T, string>>; formError: string | null } {
  const fieldErrors: Partial<Record<keyof T, string>> = {}

  if (!isApiError(error) || !error.fieldErrors) {
    return { fieldErrors, formError: getErrorMessage(error) }
  }

  const others: string[] = []
  for (const [field, message] of Object.entries(error.fieldErrors)) {
    if (isFieldOf(values, field)) {
      fieldErrors[field] = message
    } else {
      // 表單上沒有這個欄位（例如 reset-password 的 resetPasswordToken）：不能丟掉，改顯示在按鈕上方
      others.push(message)
    }
  }

  return { fieldErrors, formError: others.length > 0 ? others.join('、') : null }
}
