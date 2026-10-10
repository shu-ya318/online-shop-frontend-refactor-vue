import axios from 'axios'

export const handleApiError = (error: unknown): string => {
  if (axios.isCancel(error)) {
    return 'Canceled'
  }

  if (axios.isAxiosError(error)) {
    if (!error.response) {
      return 'NetworkError'
    }

    const data = error.response.data
    if (typeof data === 'object' && data !== null) {
      return data.files || data.message || data.error?.message || 'unknown error'
    }
  }

  return 'unknown error'
}
