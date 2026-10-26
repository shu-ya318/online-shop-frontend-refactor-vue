import { z } from 'zod'

import {
  isValidBirthDate,
  isValidBirthDateRange,
  isValidCellphone,
  isValidDateFormat,
} from '@/utils/validation'

/** 和後端驗證訊息的用字一致（後端回傳「密碼長度必須為 8-20 個字元!」） */
const PASSWORD_LENGTH_MESSAGE = '密碼長度必須為 8-20 個字元!'
/** 密碼規則只寫一份：登入、註冊、重設密碼共用，只有必填的提示文字不同 */
const passwordWith = (requiredMessage: string) =>
  z
    .string()
    .min(1, requiredMessage)
    .min(8, PASSWORD_LENGTH_MESSAGE)
    .max(20, PASSWORD_LENGTH_MESSAGE)

const email = z.email('請輸入有效格式的電子郵件!')
const password = passwordWith('請輸入密碼!')
const cellphone = z
  .string()
  .min(1, '請輸入手機號碼!')
  .refine(isValidCellphone, '請輸入 09 開頭的 10 碼手機號碼!')
export const loginSchema = z.object({ email, password })
export const signupSchema = z.object({
  email,
  username: z.string().min(1, '請輸入使用者名稱!'),
  password,
  cellphone,
  // 選填：空字串直接通過（三個驗證函式遇到空值都回傳 true）
  birthDate: z
    .string()
    .refine(isValidDateFormat, '出生日期格式必須為 yyyy-MM-dd!')
    .refine(isValidBirthDate, '出生日期必須有效且不得大於今日!')
    .refine(isValidBirthDateRange, '出生日期年齡必須介於 6 歲至 150 歲之間!')
    .optional(),
})
export const forgetPasswordSchema = z.object({ email, cellphone })
export const resetPasswordSchema = z.object({
  newPassword: passwordWith('請輸入新密碼!'),
  confirmPassword: z.string().min(1, '請再次輸入新密碼!'),
})

export type LoginValues = z.infer<typeof loginSchema>
/** 表單上的出生日期一定有值（沒填是空字串），送出時才決定要不要帶給後端 */
export type SignupValues = Required<z.infer<typeof signupSchema>>
export type ForgetPasswordValues = z.infer<typeof forgetPasswordSchema>
export type ResetPasswordValues = z.infer<typeof resetPasswordSchema>

/**
 * 確認密碼要和新密碼相同。
 * useForm 是逐欄驗證，改成 confirmPassword 的一條規則，並在 useForm 的 deps 宣告「新密碼改了要重驗」。
 */
export const confirmPasswordMatches = (
  confirmPassword: string,
  values: { newPassword: string },
): string | null => (confirmPassword === values.newPassword ? null : '新密碼與確認密碼不符!')
