import type { MembershipTier, UserRole, UserStatus } from './types'

export interface GetCurrentUserResponse {
  id: number
  email: string
  username: string
  membershipTier: MembershipTier
  role: UserRole
  cellphone: string
  birthDate?: string
  avatar: string | null
  status: UserStatus
  createdAt: string
  updatedAt: string
  lastLoginAt: string
}

export interface UpdateCellphoneRequest {
  cellphone: string
}

export interface UpdateUsernameRequest {
  username: string
}

export interface UpdatePasswordRequest {
  oldPassword: string
  newPassword: string
}

export interface UpdateBirthDateRequest {
  birthDate: string
}

export interface UpdateAvatarRequest {
  avatar: string
}

export interface GetAllUserRequest {
  keyword?: string
  page?: number
  size?: number
}

export interface UpdateStatusRequest {
  userId: number
  status: UserStatus
}

// ===== Update Responses（mutation 回傳被異動實體）=====

export interface UpdateUsernameResponse {
  username: string
  updatedAt: string // ISO 8601 UTC，含 Z
}

export interface UpdateCellphoneResponse {
  cellphone: string
  updatedAt: string // ISO 8601 UTC，含 Z
}

export interface UpdateBirthDateResponse {
  birthDate: string // yyyy-MM-dd
  membershipTier: MembershipTier | null // 僅本次自動升級 BASIC→PREMIUM 才有值，否則 null
  updatedAt: string // ISO 8601 UTC，含 Z
}

export interface UpdateStatusResponse {
  userId: number
  status: UserStatus
  updatedAt: string // ISO 8601 UTC，含 Z
}

export interface UpdateAvatarResponse {
  avatar: string // base64 data URI 或預設頭像相對路徑
  updatedAt: string // ISO 8601 UTC，含 Z
}
