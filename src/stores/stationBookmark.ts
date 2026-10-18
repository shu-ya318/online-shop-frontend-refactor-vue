import { computed, ref, shallowRef } from 'vue'
import { defineStore } from 'pinia'

import { useAuthStore } from '@/stores/auth'

import { toApiError } from '@/services/errors'
import {
  createStationBookmark,
  deleteStationBookmark,
  getAllStationBookmarkPaginated,
} from '@/services/stationBookmark'

import type { ApiError } from '@/services/errors'
import type {
  DeleteStationBookmarkResponse,
  StationBookmark,
} from '@/services/stationBookmark/interface'

/** 一次載入全部書籤的每頁筆數 */
const FETCH_ALL_SIZE = 1000

/** toggleBookmark 的結果；'login-required' 由畫面決定要提示登入還是導到登入頁 */
export type ToggleBookmarkResult = 'added' | 'removed' | 'login-required'

/** 車站書籤快取與新增、刪除、切換（userScoped：登出時重設） */
export const useStationBookmarkStore = defineStore(
  'stationBookmark',
  () => {
    const bookmarks = ref<StationBookmark[]>([])
    const hasLoaded = ref(false)
    const isBookmarksLoading = ref(false)
    const bookmarksError = shallowRef<ApiError | null>(null)
    /** 正在新增或刪除書籤的車站 id，按鈕可以據此 disabled */
    const pendingStationIds = ref(new Set<number>())

    const bookmarkedStationIds = computed(
      () => new Set(bookmarks.value.map((bookmark) => bookmark.stationId)),
    )
    /** 帶參數的 getter：isBookmarked(stationId) */
    const isBookmarked = computed(
      () => (stationId: number) => bookmarkedStationIds.value.has(stationId),
    )
    const isPending = computed(() => (stationId: number) => pendingStationIds.value.has(stationId))

    /** $reset() 時 +1：登出前發出的請求，回來後不能寫進下一個使用者的快取 */
    let generation = 0
    let loadRequest: Promise<void> | null = null
    const toggleRequests = new Map<number, Promise<ToggleBookmarkResult>>()

    /** 實際載入全部書籤。不會 reject：失敗時把錯誤放進 bookmarksError */
    const load = async (): Promise<void> => {
      const startedAt = generation
      isBookmarksLoading.value = true
      bookmarksError.value = null

      try {
        const response = await getAllStationBookmarkPaginated({ page: 0, size: FETCH_ALL_SIZE })

        if (startedAt !== generation) {
          return
        }

        bookmarks.value = response.content
        hasLoaded.value = true
      } catch (e) {
        if (startedAt !== generation) {
          return
        }

        bookmarksError.value = await toApiError(e)
      } finally {
        // 已作廢的請求不能動到新一輪的狀態（$reset() 已經清掉了）
        if (startedAt === generation) {
          isBookmarksLoading.value = false
          loadRequest = null
        }
      }
    }

    /**
     * 確保書籤已載入（未登入時什麼都不做）。不會 reject：失敗時看 bookmarksError。
     * 同時呼叫共用同一個請求；失敗後再呼叫會重試。
     */
    const ensureLoaded = (): Promise<void> => {
      if (!useAuthStore().isAuthenticated || hasLoaded.value) {
        return Promise.resolve()
      }

      loadRequest ??= load()
      return loadRequest
    }

    /** 新增、刪除前先等進行中的載入結束，避免載入結果晚回來蓋掉剛改的資料 */
    const waitForLoad = async (): Promise<void> => {
      if (loadRequest) {
        await loadRequest
      }
    }

    /** 新增書籤。失敗 reject ApiError（例如超過會員上限、重複收藏） */
    const addBookmark = async (stationId: number): Promise<StationBookmark> => {
      await waitForLoad()

      const startedAt = generation
      const created = await createStationBookmark({ stationId })

      if (startedAt === generation && !bookmarkedStationIds.value.has(stationId)) {
        bookmarks.value = [...bookmarks.value, created]
      }

      return created
    }

    /**
     * 刪除書籤（書籤頁、地圖、旅程卡都走這裡）。失敗 reject ApiError。
     * 快取還沒載入也可以刪；有載入就同步移除。
     */
    const removeBookmark = async (
      bookmark: Pick<StationBookmark, 'id'>,
    ): Promise<DeleteStationBookmarkResponse> => {
      await waitForLoad()

      const startedAt = generation
      const response = await deleteStationBookmark({ bookmarkId: bookmark.id })

      if (startedAt === generation) {
        bookmarks.value = bookmarks.value.filter((item) => item.id !== bookmark.id)
      }

      return response
    }

    /** 依目前是否已收藏決定新增或刪除 */
    const runToggle = async (stationId: number): Promise<ToggleBookmarkResult> => {
      // 要先知道這一站目前有沒有收藏，才能決定是新增還是刪除；載入失敗就不能亂猜
      await ensureLoaded()

      if (bookmarksError.value) {
        throw bookmarksError.value
      }

      const existing = bookmarks.value.find((bookmark) => bookmark.stationId === stationId)

      if (existing) {
        await removeBookmark(existing)
        return 'removed'
      }

      await addBookmark(stationId)
      return 'added'
    }

    /**
     * 切換收藏。未登入回傳 'login-required'（不打 API）；API 失敗 reject ApiError。
     * 同一站連點時共用進行中的操作，不會送出兩次新增（後端會回「重複收藏」）。
     */
    const toggleBookmark = (stationId: number): Promise<ToggleBookmarkResult> => {
      if (!useAuthStore().isAuthenticated) {
        return Promise.resolve('login-required')
      }

      const running = toggleRequests.get(stationId)
      if (running) {
        return running
      }

      const startedAt = generation
      const task = runToggle(stationId).finally(() => {
        // 只清自己的紀錄（$reset 之後同一站可能已經有新的操作）
        if (toggleRequests.get(stationId) === task) {
          toggleRequests.delete(stationId)
        }

        if (startedAt === generation) {
          pendingStationIds.value.delete(stationId)
        }
      })

      toggleRequests.set(stationId, task)
      pendingStationIds.value.add(stationId)
      return task
    }

    /** 清空快取並作廢進行中的請求 */
    const $reset = () => {
      generation++
      loadRequest = null
      toggleRequests.clear()
      bookmarks.value = []
      hasLoaded.value = false
      isBookmarksLoading.value = false
      bookmarksError.value = null
      pendingStationIds.value = new Set()
    }

    return {
      bookmarks,
      hasLoaded,
      isBookmarksLoading,
      bookmarksError,
      pendingStationIds,
      bookmarkedStationIds,
      isBookmarked,
      isPending,
      ensureLoaded,
      addBookmark,
      removeBookmark,
      toggleBookmark,
      $reset,
    }
  },
  // 登出、換帳號、登入失效時由 auth store 呼叫 $reset()，避免下一位使用者看到上一位的書籤
  { userScoped: true },
)
