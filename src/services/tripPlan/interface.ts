import type { PaginatedResponse } from '../common/interface'

// Create Trip Plan
export interface CreateTripPlanRequest {
  name: string
  fromStationId: number
  toStationId: number
  fareType: number
  farePrice: number | null
  transferCount: number
  routingStrategy: number
  notes?: string
}

// TripPlan
export interface TripPlan {
  id: number
  name: string
  fromStationId: number
  fromStationNameZhTw: string
  toStationId: number
  toStationNameZhTw: string
  fareType: number
  farePrice: number | null
  transferCount: number
  routingStrategy: number
  travelTimeSeconds: number
  notes: string | null
  createdAt: string
  updatedAt: string
}

// Get Trip Plan
export interface GetTripPlanParams {
  keyword: string
}

// All Trip Plan Name
export type GetAllTripPlanNameResponse = string[]

// All Trip Plan Paginated
export interface GetAllTripPlanPaginatedRequest {
  keyword?: string
  page?: number
  size?: number
  sortDirection?: 'ASC' | 'DESC'
}

export type GetAllTripPlanPaginatedResponse = PaginatedResponse<TripPlan>

// Delete Trip Plan
export interface DeleteTripPlanRequest {
  tripPlanId: number
}

export interface DeleteTripPlanResponse {
  message: string
}

// Update Trip Plan Name
export interface UpdateTripPlanNameRequest {
  tripPlanId: number
  name: string
}

export interface UpdateTripPlanNameResponse {
  id: number
  name: string
  updatedAt: string // ⚠ ISO 8601 無時區資訊，值為 UTC（顯示請走 formatDateTime）
}

// Update Trip Plan Info
export interface UpdateTripPlanRequest {
  tripPlanId: number
  fareType: number
  farePrice: number | null
  transferCount: number
  routingStrategy: number
  notes?: string
}

export interface UpdateTripPlanInfoResponse {
  id: number
  fareType: number // 1=全票, 4=學生, 5=兒童, 7=愛心
  farePrice: number | null // 後端 BigDecimal 序列化為 number
  transferCount: number
  routingStrategy: number // 1=最少轉乘次數, 2=最短車程時間
  notes: string | null
  updatedAt: string // ⚠ ISO 8601 無時區資訊，值為 UTC（顯示請走 formatDateTime）
}

// Get Excel By Trip Plan Id
export interface GetExcelByTripPlanIdRequest {
  tripPlanId: number
}
