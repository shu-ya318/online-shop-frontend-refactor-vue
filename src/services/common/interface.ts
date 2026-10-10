export interface ApiResponse {
  message: string
}

// user/update-password 與 auth/reset-password 共用（密碼本身不回傳）
export interface UpdatePasswordResponse {
  updatedAt: string // ISO 8601 UTC，含 Z
}

export interface PaginatedResponse<T> {
  content: T[]
  page: number
  size: number
  totalElements: number
  totalPages: number
}
