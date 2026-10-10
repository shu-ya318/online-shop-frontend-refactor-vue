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

export const signup = async (request: SignupRequest): Promise<AuthResponse> => {
  return await post<AuthResponse>('/auth/sign-up', request)
}

export const login = async (request: LoginRequest): Promise<AuthResponse> => {
  return await post<AuthResponse>('/auth/log-in', request)
}

// 刷新 token 一律經由 tokenManager（single-flight），這裡不再對外暴露直接呼叫 /auth/refresh-tokens 的函式。
// 需要手動刷新時用 tokenManager.refresh()（從 '@/services/http' 匯入）。

export const logout = async () => {
  await post('/auth/log-out')
}

export const forgetPassword = async (
  request: ForgetPasswordRequest,
): Promise<ForgetPasswordResponse> => {
  return await post<ForgetPasswordResponse>('/auth/forget-password', request)
}

export const resetPassword = async (
  request: ResetPasswordRequest,
): Promise<UpdatePasswordResponse> => {
  return await post<UpdatePasswordResponse>('/auth/reset-password', request)
}
