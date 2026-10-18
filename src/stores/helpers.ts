import { ApiError, getErrorMessage, isApiError } from '@/services/errors'
/**
 * store 的錯誤狀態一律存 ApiError，畫面直接用 error.message 顯示。
 * services 透過 http.ts 呼叫時 reject 的已經是 ApiError；這裡只是保險（例如程式本身的 TypeError）。
 */
export const asApiError = (error: unknown): ApiError =>
  isApiError(error)
    ? error
    : new ApiError({ kind: 'unknown', status: 0, message: getErrorMessage(error), cause: error })
