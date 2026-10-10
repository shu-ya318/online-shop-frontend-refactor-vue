import axios, { type AxiosError, type AxiosInstance, type AxiosRequestConfig } from 'axios'
import { jwtDecode } from 'jwt-decode'

import { handleApiError } from './error'

import type { AuthResponse } from './auth/interface'

interface ErrorBody {
  message?: string
  error?: { message: string }
  files?: string[]
}

export interface TokenManager {
  getAccessToken: () => string | null
  setAccessToken: (token: string | null) => void
  clearAuth: () => void
}

export interface HttpClient {
  instance: AxiosInstance
  tokenManager: TokenManager
  post: <T>(url: string, data?: unknown, config?: AxiosRequestConfig) => Promise<T>
}

const REFRESH_URL = '/auth/refresh-tokens'

const createTokenManager = (): TokenManager => {
  let accessToken: string | null = null

  return {
    getAccessToken: () => accessToken,
    setAccessToken: (token) => {
      accessToken = token
    },
    clearAuth: () => {
      accessToken = null
    },
  }
}

const createHttpClient = (): HttpClient => {
  const instance = axios.create({
    baseURL: '/api/v1',
    timeout: 10000,
  })
  const tokenManager = createTokenManager()

  instance.interceptors.request.use(async (config) => {
    if (config.url?.includes(REFRESH_URL)) {
      return config
    }

    const accessToken = tokenManager.getAccessToken()
    if (!accessToken) {
      return config
    }

    const { exp } = jwtDecode(accessToken)
    const isExpired = exp !== undefined && exp * 1000 < Date.now()

    if (!isExpired) {
      config.headers.Authorization = `Bearer ${accessToken}`
      return config
    }

    try {
      const { data } = await instance.post<AuthResponse>(REFRESH_URL)
      tokenManager.setAccessToken(data.accessToken)
      config.headers.Authorization = `Bearer ${data.accessToken}`
      return config
    } catch (error) {
      console.error('[API Request] Refresh failed', error)
      tokenManager.clearAuth()
      window.location.href = '/auth/login'
      return Promise.reject(error)
    }
  })

  instance.interceptors.response.use(
    (response) => response,
    (error: AxiosError<ErrorBody>) => {
      if (error.response?.status === 401) {
        tokenManager.clearAuth()
        if (!window.location.pathname.includes('/auth/login')) {
          window.location.href = '/auth/login'
        }
      }

      if (error.response?.status === 403) {
        window.location.href = '/unauthorized'
      }

      console.error('[API Error]', {
        url: error.config?.url,
        status: error.response?.status,
        data: error.response?.data,
        message: error.message,
      })

      const data = error.response?.data
      const errorMessage =
        data?.message || data?.error?.message || data?.files || handleApiError(error)

      return Promise.reject(errorMessage)
    },
  )

  const post = async <T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> => {
    const response = await instance.post<T>(url, data, config)
    return response.data
  }

  return { instance, tokenManager, post }
}

export const httpClient = createHttpClient()
export const { post, tokenManager } = httpClient
