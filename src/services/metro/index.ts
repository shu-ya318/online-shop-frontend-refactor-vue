import { post } from '../http'

import type {
  GetMetroMapResponse,
  GetAllStationResponse,
  GetAllStationOptionResponse,
  GetAllLineResponse,
  GetAllLineTransferResponse,
  GetAllLineStationResponse,
  GetStationByCodeRequest,
  StationDetail,
  GetStationByIdRequest,
  Station,
  GetAllStationPaginatedRequest,
  GetAllStationPaginatedResponse,
  GetAllStationIdOptionResponse,
  GetOriginDestinationDetailsRequest,
  GetOriginDestinationDetailsResponse,
  UpdateStationRequest,
  UpdateStationResponse,
} from './interface'

export const getMetroMap = async (): Promise<GetMetroMapResponse> => {
  return await post<GetMetroMapResponse>('/metro/get-metro-map')
}

export const getStationByCode = async (
  request: GetStationByCodeRequest,
): Promise<StationDetail> => {
  return await post<StationDetail>('/metro/get-station-by-code', request)
}

export const getAllStation = async (): Promise<GetAllStationResponse> => {
  return await post<GetAllStationResponse>('/metro/get-all-station')
}

export const getAllStationOption = async (): Promise<GetAllStationOptionResponse> => {
  return await post<GetAllStationOptionResponse>('/metro/get-all-station-option')
}

export const getAllLine = async (): Promise<GetAllLineResponse> => {
  return await post<GetAllLineResponse>('/metro/get-all-line')
}

export const getAllLineTransfer = async (): Promise<GetAllLineTransferResponse> => {
  return await post<GetAllLineTransferResponse>('/metro/get-all-line-transfer')
}

export const getAllLineStation = async (): Promise<GetAllLineStationResponse> => {
  return await post<GetAllLineStationResponse>('/metro/get-all-line-station')
}

export const getStationById = async (request: GetStationByIdRequest): Promise<Station> => {
  return await post<Station>('/metro/get-station-by-id', request)
}

export const getAllStationPaginated = async (
  request: GetAllStationPaginatedRequest,
): Promise<GetAllStationPaginatedResponse> => {
  return await post<GetAllStationPaginatedResponse>(
    '/metro/get-all-station-paginated',
    {},
    { params: request },
  )
}

export const getAllStationIdOption = async (): Promise<GetAllStationIdOptionResponse> => {
  return await post<GetAllStationIdOptionResponse>('/metro/get-all-station-id-option')
}

export const getOriginDestinationDetails = async (
  request: GetOriginDestinationDetailsRequest,
): Promise<GetOriginDestinationDetailsResponse> => {
  return await post<GetOriginDestinationDetailsResponse>(
    '/metro/get-origin-destination-detail',
    request,
  )
}

export const updateStation = async (
  request: UpdateStationRequest,
): Promise<UpdateStationResponse> => {
  return await post<UpdateStationResponse>('/metro/update-station', request)
}
