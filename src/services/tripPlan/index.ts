import { post } from '../http'

import type {
  CreateTripPlanRequest,
  DeleteTripPlanRequest,
  DeleteTripPlanResponse,
  GetAllTripPlanNameResponse,
  GetAllTripPlanPaginatedRequest,
  GetAllTripPlanPaginatedResponse,
  GetExcelByTripPlanIdRequest,
  GetTripPlanParams,
  TripPlan,
  UpdateTripPlanInfoResponse,
  UpdateTripPlanNameRequest,
  UpdateTripPlanNameResponse,
  UpdateTripPlanRequest,
} from './interface'

export const createTripPlan = async (request: CreateTripPlanRequest): Promise<TripPlan> => {
  return await post<TripPlan>('/trip-plan/create-plan', request)
}

// 取得當前使用者建立的所有旅程規劃名稱，依建立時間新到舊排序
export const getAllTripPlanName = async (): Promise<GetAllTripPlanNameResponse> => {
  return await post<GetAllTripPlanNameResponse>('/trip-plan/get-all-plan-name')
}

// 以旅程名稱模糊搜尋當前使用者的旅程規劃，回傳符合條件中最新建立的一筆
export const getTripPlan = async (params: GetTripPlanParams): Promise<TripPlan> => {
  return await post<TripPlan>(
    '/trip-plan/get-plan',
    {},
    {
      params,
    },
  )
}

export const getAllTripPlanPaginated = async (
  request: GetAllTripPlanPaginatedRequest = {},
): Promise<GetAllTripPlanPaginatedResponse> => {
  return await post<GetAllTripPlanPaginatedResponse>(
    '/trip-plan/get-all-plan-paginated',
    {},
    { params: request },
  )
}

export const deleteTripPlan = async (
  request: DeleteTripPlanRequest,
): Promise<DeleteTripPlanResponse> => {
  return await post<DeleteTripPlanResponse>('/trip-plan/delete-plan', request)
}

export const updateTripPlanName = async (
  request: UpdateTripPlanNameRequest,
): Promise<UpdateTripPlanNameResponse> => {
  return await post<UpdateTripPlanNameResponse>('/trip-plan/update-plan-name', request)
}

export const updateTripPlan = async (
  request: UpdateTripPlanRequest,
): Promise<UpdateTripPlanInfoResponse> => {
  return await post<UpdateTripPlanInfoResponse>('/trip-plan/update-plan', request)
}

export const getExcelByTripPlanId = async (request: GetExcelByTripPlanIdRequest): Promise<Blob> => {
  return await post<Blob>('/trip-plan/get-excel-by-trip-plan-id', request, {
    responseType: 'blob',
  })
}
