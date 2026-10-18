import axios, { type AxiosError } from 'axios'

/** 錯誤種類：HTTP 有回應、逾時、網路不通、被取消、其他非預期錯誤 */
export type ApiErrorKind = 'http' | 'timeout' | 'network' | 'canceled' | 'unknown'

/** 後端 Bean Validation 失敗時的「欄位 → 訊息」（GlobalExceptionHandler 回傳的 map） */
export type FieldErrors = Record<string, string>

export interface ApiErrorInit {
  kind: ApiErrorKind
  /** HTTP 狀態碼；逾時、網路錯誤、取消時為 0 */
  status: number
  /** 可以直接顯示給使用者的訊息 */
  message: string
  fieldErrors?: FieldErrors
  cause?: unknown
}

/**
 * 所有 API 失敗統一轉成的錯誤型別。
 * `message` 已是可直接顯示的繁中訊息；只負責描述錯誤，不做導頁等副作用。
 */
export class ApiError extends Error {
  readonly kind: ApiErrorKind
  readonly status: number
  /** 只有後端回傳驗證 map 時才有值，表單可以逐欄顯示 */
  readonly fieldErrors?: FieldErrors

  constructor(init: ApiErrorInit) {
    super(init.message, { cause: init.cause })
    this.name = 'ApiError'
    this.kind = init.kind
    this.status = init.status
    this.fieldErrors = init.fieldErrors
  }
}

/** 判斷是否為 ApiError（type guard） */
export const isApiError = (error: unknown): error is ApiError => error instanceof ApiError

/** 取得可顯示的錯誤訊息：ApiError 回傳其 message，其他錯誤回傳 fallback */
export const getErrorMessage = (
  error: unknown,
  fallback = '發生未預期的錯誤，請稍後再試',
): string => (isApiError(error) ? error.message : fallback)

const KIND_MESSAGES: Record<Exclude<ApiErrorKind, 'http'>, string> = {
  timeout: '請求逾時，請稍後再試',
  network: '網路連線異常，請檢查網路後再試',
  canceled: '請求已取消',
  unknown: '發生未預期的錯誤，請稍後再試',
}

const messageForStatus = (status: number): string => {
  switch (status) {
    case 400:
      return '請求內容有誤'
    case 401:
      return '登入已失效，請重新登入'
    case 403:
      return '沒有權限執行此操作'
    case 404:
      return '找不到資料'
    case 409:
      return '資料衝突，請重新整理後再試'
    default:
      return status >= 500 ? '伺服器發生錯誤，請稍後再試' : KIND_MESSAGES.unknown
  }
}

interface ParsedErrorBody {
  message?: string
  fieldErrors?: FieldErrors
}

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const tryParseJson = (text: string): unknown => {
  try {
    return JSON.parse(text)
  } catch {
    return undefined
  }
}

/**
 * 解析後端錯誤 body，取出可顯示的訊息。
 * 支援 `{ message }` 與 `{ 欄位: 訊息 }` map 兩種格式；其他格式（HTML、空值等）回傳空物件。
 */
export const parseErrorBody = (body: unknown): ParsedErrorBody => {
  // 字串先試著當 JSON；不是 JSON（HTML 錯誤頁、CORS 被拒的純文字）就放棄解析
  const data = typeof body === 'string' ? tryParseJson(body) : body
  if (!isPlainObject(data)) {
    return {}
  }

  if (typeof data.message === 'string' && data.message.trim() !== '') {
    return { message: data.message }
  }

  const entries = Object.entries(data)
  if (entries.length > 0 && entries.every(([, value]) => typeof value === 'string')) {
    const fieldErrors = Object.fromEntries(entries) as FieldErrors
    const message = Object.values(fieldErrors)
      .filter((text) => text.trim() !== '')
      .join('、')
    return message ? { message, fieldErrors } : {}
  }

  return {}
}

/** responseType: 'blob' 時，錯誤 body 也是 Blob，要先讀成文字 */
const readBody = async (data: unknown): Promise<unknown> => {
  if (typeof Blob !== 'undefined' && data instanceof Blob) {
    try {
      return await data.text()
    } catch {
      return undefined
    }
  }
  return data
}

const isTimeoutError = (error: AxiosError): boolean =>
  error.code === 'ETIMEDOUT' || error.code === 'ECONNABORTED'

/** 把任何錯誤轉成 ApiError；已經是 ApiError 就原樣回傳 */
export const toApiError = async (error: unknown): Promise<ApiError> => {
  if (isApiError(error)) {
    return error
  }

  // 取消也是 AxiosError，所以要先判斷
  if (axios.isCancel(error)) {
    return new ApiError({
      kind: 'canceled',
      status: 0,
      message: KIND_MESSAGES.canceled,
      cause: error,
    })
  }

  if (axios.isAxiosError(error)) {
    const { response } = error
    if (!response) {
      const kind = isTimeoutError(error) ? 'timeout' : 'network'
      return new ApiError({ kind, status: 0, message: KIND_MESSAGES[kind], cause: error })
    }

    const { message, fieldErrors } = parseErrorBody(await readBody(response.data))
    return new ApiError({
      kind: 'http',
      status: response.status,
      message: message ?? messageForStatus(response.status),
      fieldErrors,
      cause: error,
    })
  }

  return new ApiError({
    kind: 'unknown',
    status: 0,
    message: KIND_MESSAGES.unknown,
    cause: error,
  })
}
