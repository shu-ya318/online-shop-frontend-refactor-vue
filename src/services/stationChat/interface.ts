import type { PaginatedResponse } from '../common/interface'
import type { ChatType, ChatEventType } from './types'

export interface MessageResponse {
  message: string
}

// Station Chat Message
export interface StationChatMessage {
  id: number
  username: string
  avatar: string | null
  chatType: ChatType
  content: string | null
  tripPlanId: number | null
  fromStationName: string | null
  toStationName: string | null
  fareType: number | null
  farePrice: number | null
  transferCount: number | null
  travelTimeSeconds: number | null
  notes: string | null
  createdAt: string
}

export interface GetMessageByStationIdRequest {
  stationId: number
  page?: number
  size?: number
}

export type GetMessageByStationIdResponse = PaginatedResponse<StationChatMessage>

export interface GetExcelByStationIdRequest {
  stationId: number
}

// Station Chat Announcement
export interface StationChatAnnouncement {
  id: number
  stationId: number
  content: string
  createdByUsername: string
  createdAt: string
  updatedAt: string
}

export interface GetAnnouncementByStationIdRequest {
  stationId: number
  page?: number
  size?: number
}

export type GetAnnouncementByStationIdResponse = PaginatedResponse<StationChatAnnouncement>

export interface CreateAnnouncementRequest {
  stationId: number
  content: string
}

export interface UpdateAnnouncementRequest {
  announcementId: number
  content: string
}

export interface UpdateAnnouncementResponse {
  id: number
  content: string
  updatedAt: string // ⚠ ISO 8601 無時區資訊，值為 UTC（顯示請走 formatDateTime）
}

export interface DeleteAnnouncementRequest {
  announcementId: number
}

// STOMP  message
export interface SendMessagePayload {
  chatType: ChatType
  content?: string | null
  tripPlanId?: number | null
}

export interface StationChatEvent {
  eventType: ChatEventType
  message?: StationChatMessage
  deletedMessageId?: number
}
