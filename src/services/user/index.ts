import { post } from '../http'

import type { PaginatedResponse, UpdatePasswordResponse } from '../common/interface'
import type {
  GetAllUserRequest,
  GetCurrentUserResponse,
  UpdateAvatarRequest,
  UpdateAvatarResponse,
  UpdateBirthDateRequest,
  UpdateBirthDateResponse,
  UpdateCellphoneRequest,
  UpdateCellphoneResponse,
  UpdatePasswordRequest,
  UpdateStatusRequest,
  UpdateStatusResponse,
  UpdateUsernameRequest,
  UpdateUsernameResponse,
} from './interface'

export const getCurrentUser = async (): Promise<GetCurrentUserResponse> => {
  return await post<GetCurrentUserResponse>('/user/get-current-user')
}

export const getAllUser = async (
  request: GetAllUserRequest = {},
): Promise<PaginatedResponse<GetCurrentUserResponse>> => {
  return await post<PaginatedResponse<GetCurrentUserResponse>>(
    '/user/get-all-user',
    {},
    { params: request },
  )
}

export const updateUsername = async (
  request: UpdateUsernameRequest,
): Promise<UpdateUsernameResponse> => {
  return await post<UpdateUsernameResponse>('/user/update-username', request)
}

export const updatePassword = async (
  request: UpdatePasswordRequest,
): Promise<UpdatePasswordResponse> => {
  return await post<UpdatePasswordResponse>('/user/update-password', request)
}

export const updateCellphone = async (
  request: UpdateCellphoneRequest,
): Promise<UpdateCellphoneResponse> => {
  return await post<UpdateCellphoneResponse>('/user/update-cellphone', request)
}

export const updateBirthDate = async (
  request: UpdateBirthDateRequest,
): Promise<UpdateBirthDateResponse> => {
  return await post<UpdateBirthDateResponse>('/user/update-birth-date', request)
}

export const updateStatus = async (request: UpdateStatusRequest): Promise<UpdateStatusResponse> => {
  return await post<UpdateStatusResponse>('/user/update-status', request)
}

export const updateAvatar = async (request: UpdateAvatarRequest): Promise<UpdateAvatarResponse> => {
  return await post<UpdateAvatarResponse>('/user/update-avatar', request)
}

export const removeAvatar = async (): Promise<UpdateAvatarResponse> => {
  return await post<UpdateAvatarResponse>('/user/remove-avatar')
}
