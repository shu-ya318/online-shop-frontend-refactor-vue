import { post } from '../http'

import type {
  CreateAnnouncementRequest,
  DeleteAnnouncementRequest,
  GetAnnouncementByStationIdRequest,
  GetAnnouncementByStationIdResponse,
  GetExcelByStationIdRequest,
  GetMessageByStationIdRequest,
  GetMessageByStationIdResponse,
  MessageResponse,
  UpdateAnnouncementRequest,
  UpdateAnnouncementResponse,
} from './interface'

export const createAnnouncement = async (
  request: CreateAnnouncementRequest,
): Promise<MessageResponse> => {
  return await post<MessageResponse>('/station-chat/create-announcement', request)
}

export const getMessageByStationId = async (
  request: GetMessageByStationIdRequest,
): Promise<GetMessageByStationIdResponse> => {
  return await post<GetMessageByStationIdResponse>(
    '/station-chat/get-message-by-station-id',
    {},
    { params: request },
  )
}

export const getAnnouncementByStationId = async (
  request: GetAnnouncementByStationIdRequest,
): Promise<GetAnnouncementByStationIdResponse> => {
  return await post<GetAnnouncementByStationIdResponse>(
    '/station-chat/get-announcement-by-station-id',
    {},
    { params: request },
  )
}

export const getExcelByStationId = async (request: GetExcelByStationIdRequest): Promise<Blob> => {
  return await post<Blob>('/station-chat/get-excel-by-station-id', request, {
    responseType: 'blob',
  })
}

export const updateAnnouncement = async (
  request: UpdateAnnouncementRequest,
): Promise<UpdateAnnouncementResponse> => {
  return await post<UpdateAnnouncementResponse>('/station-chat/update-announcement', request)
}

export const deleteAnnouncement = async (
  request: DeleteAnnouncementRequest,
): Promise<MessageResponse> => {
  return await post<MessageResponse>('/station-chat/delete-announcement', request)
}
