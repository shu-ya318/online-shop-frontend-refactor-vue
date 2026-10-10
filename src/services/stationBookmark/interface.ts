import type { PaginatedResponse } from '../common/interface'

// All Station Bookmark Paginated

export interface GetAllStationBookmarkPaginatedRequest {
  keyword?: string
  page?: number
  size?: number
  sortDirection?: 'ASC' | 'DESC'
}

export interface StationBookmark {
  id: number
  stationId: number
  stationNameZhTw: string
  stationNameEn: string
  userId: number
  username: string
  email: string
  createdAt: string
}

export type GetAllStationBookmarkPaginatedResponse = PaginatedResponse<StationBookmark>

// Create Station Bookmark

export interface CreateStationBookmarkRequest {
  stationId: number
}

// Delete Station Bookmark

export interface DeleteStationBookmarkRequest {
  bookmarkId: number
}

export interface DeleteStationBookmarkResponse {
  message: string
}

// Get Station Bookmark By Station Name

export interface GetStationBookmarkByStationNameRequest {
  stationName: string
}

export interface StationBookmarkResponse {
  id: number
  stationId: number
  stationNameZhTw: string
  stationNameEn: string
  userId: number
  username: string
  email: string
  createdAt: string
}
