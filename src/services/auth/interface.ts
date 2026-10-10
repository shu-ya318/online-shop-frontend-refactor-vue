export interface SignupRequest {
  email: string
  username: string
  password: string
  cellphone: string
  birthDate?: string
}

export interface LoginRequest {
  email: string
  password: string
}

export interface AuthResponse {
  accessToken: string
  refreshToken: string
}

export interface ForgetPasswordRequest {
  email: string
  cellphone: string
}

export interface ForgetPasswordResponse {
  resetPasswordToken: string
}

export interface ResetPasswordRequest {
  resetPasswordToken: string
  newPassword: string
}
