import type { ZodType } from 'zod'

import type { ErrorMessage } from '@/composables/useForm'

/** 把 zod schema 轉成 useForm 的同步規則：取第一個錯誤訊息 */
export const zodRule =
  (schema: ZodType) =>
  (value: unknown): ErrorMessage => {
    const result = schema.safeParse(value)
    return result.success ? null : (result.error.issues[0]?.message ?? '格式不正確')
  }
