import { post } from '../http'

import type {
  CreateStationBookmarkRequest,
  DeleteStationBookmarkRequest,
  DeleteStationBookmarkResponse,
  GetAllStationBookmarkPaginatedRequest,
  GetAllStationBookmarkPaginatedResponse,
  GetStationBookmarkByStationNameRequest,
  StationBookmark,
  StationBookmarkResponse,
} from './interface'

export const createStationBookmark = async (
  request: CreateStationBookmarkRequest,
): Promise<StationBookmark> => {
  return await post<StationBookmark>('/station-bookmark/create-bookmark', request)
}

export const getAllStationBookmarkPaginated = async (
  request: GetAllStationBookmarkPaginatedRequest = {},
): Promise<GetAllStationBookmarkPaginatedResponse> => {
  return await post<GetAllStationBookmarkPaginatedResponse>(
    '/station-bookmark/get-all-bookmark-paginated',
    {},
    { params: request },
  )
}

export const getStationBookmarkExcel = async (): Promise<Blob> => {
  return await post<Blob>('/station-bookmark/get-excel', {}, { responseType: 'blob' })
}

export const getStationBookmarkByStationName = async (
  request: GetStationBookmarkByStationNameRequest,
): Promise<StationBookmarkResponse> => {
  return await post<StationBookmarkResponse>(
    '/station-bookmark/get-bookmark-by-station-name',
    {},
    { params: request },
  )
}

export const deleteStationBookmark = async (
  request: DeleteStationBookmarkRequest,
): Promise<DeleteStationBookmarkResponse> => {
  return await post<DeleteStationBookmarkResponse>('/station-bookmark/delete-bookmark', request)
}
