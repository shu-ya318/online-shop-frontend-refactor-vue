import { ref, watch } from 'vue'
import { defineStore } from 'pinia'

import { useAuthStore } from '@/stores/authStore'

import { getErrorMessage } from '@/services/errors'
import {
  createStationBookmark,
  deleteStationBookmark,
  getAllStationBookmarkPaginated,
} from '@/services/stationBookmark'

import type { StationBookmark } from '@/services/stationBookmark/interface'

const FETCH_ALL_SIZE = 1000

export const useStationBookmarkStore = defineStore('stationBookmark', () => {
  const authStore = useAuthStore()

  const bookmarks = ref<StationBookmark[]>([])
  const isBookmarksLoading = ref(false)
  const hasFetched = ref(false)
  const error = ref<string | null>(null)

  const fetchAllBookmark = async () => {
    if (hasFetched.value || !authStore.isAuthenticated) return

    isBookmarksLoading.value = true
    error.value = null

    try {
      const response = await getAllStationBookmarkPaginated({ page: 0, size: FETCH_ALL_SIZE })
      bookmarks.value = response.content
      hasFetched.value = true
    } catch (e) {
      error.value = getErrorMessage(e, '取得車站書籤失敗')
    } finally {
      isBookmarksLoading.value = false
    }
  }

  /**
   * 切換書籤。回傳是否成功；未登入或失敗回傳 false，原因放在 error，
   * 由呼叫端決定要不要提示（例如導向登入）。
   */
  const toggleBookmark = async (stationId: number): Promise<boolean> => {
    error.value = null

    if (!authStore.isAuthenticated) {
      error.value = '請先登入以使用車站書籤功能'
      return false
    }

    const existing = bookmarks.value.find((bookmark) => bookmark.stationId === stationId)

    try {
      if (existing) {
        await deleteStationBookmark({ bookmarkId: existing.id })
        bookmarks.value = bookmarks.value.filter((bookmark) => bookmark.id !== existing.id)
      } else {
        const response = await createStationBookmark({ stationId })
        bookmarks.value = [...bookmarks.value, response]
      }
      return true
    } catch (e) {
      error.value = getErrorMessage(e, '更新車站書籤失敗')
      return false
    }
  }

  /** 清空書籤狀態（token 被清掉時會自動呼叫） */
  const reset = () => {
    bookmarks.value = []
    hasFetched.value = false
    error.value = null
  }

  // 登出或登入失效（token 被清掉）時自動清空，避免下一位使用者看到上一位的書籤
  watch(
    () => authStore.isAuthenticated,
    (isAuthenticated) => {
      if (!isAuthenticated) reset()
    },
  )

  return {
    bookmarks,
    isBookmarksLoading,
    hasFetched,
    error,
    fetchAllBookmark,
    toggleBookmark,
    reset,
  }
})
