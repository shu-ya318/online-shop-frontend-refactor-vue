import { post } from '../http'

import type { UpdatePasswordResponse } from '../common/interface'
import type {
  LoginRequest,
  SignupRequest,
  AuthResponse,
  ForgetPasswordRequest,
  ForgetPasswordResponse,
  ResetPasswordRequest,
} from './interface'

/** 註冊新帳號，成功回傳 token */
export const signup = async (request: SignupRequest): Promise<AuthResponse> => {
  return await post<AuthResponse>('/auth/sign-up', request)
}

/** 以 email 與密碼登入，成功回傳 token；密碼錯誤的 401 不會觸發 token 刷新 */
export const login = async (request: LoginRequest): Promise<AuthResponse> => {
  return await post<AuthResponse>('/auth/log-in', request)
}

// 刷新 token 一律經由 tokenManager（single-flight），這裡不再對外暴露直接呼叫 /auth/refresh-tokens 的函式。
// 需要手動刷新時用 tokenManager.refresh()（從 '@/services/http' 匯入）。

/** 登出，通知後端使 refresh token 失效 */
export const logout = async () => {
  await post('/auth/log-out')
}

/** 以 email 與手機驗證身分，成功回傳重設密碼用的 token */
export const forgetPassword = async (
  request: ForgetPasswordRequest,
): Promise<ForgetPasswordResponse> => {
  return await post<ForgetPasswordResponse>('/auth/forget-password', request)
}

/** 以重設密碼 token 設定新密碼 */
export const resetPassword = async (
  request: ResetPasswordRequest,
): Promise<UpdatePasswordResponse> => {
  return await post<UpdatePasswordResponse>('/auth/reset-password', request)
}
