import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Pinia } from 'pinia'

import { useStationBookmarkStore } from '@/stores/stationBookmark'
import { tokenManager } from '@/services/http'
import {
  createStationBookmark,
  deleteStationBookmark,
  getAllStationBookmarkPaginated,
} from '@/services/stationBookmark'
import { ApiError } from '@/services/errors'
import type {
  GetAllStationBookmarkPaginatedResponse,
  StationBookmark,
} from '@/services/stationBookmark/interface'
import {
  createDeferred,
  createTestPinia,
  makeAccessToken,
  releaseTestPinia,
} from '@/test/testUtils'

vi.mock('@/services/stationBookmark')

const makeBookmark = (overrides: Partial<StationBookmark> = {}): StationBookmark => ({
  id: 1,
  stationId: 10,
  stationNameZhTw: '台北車站',
  stationNameEn: 'Taipei Main Station',
  userId: 1,
  username: '王小明',
  email: 'ming@example.com',
  createdAt: '2026-01-01T00:00:00',
  ...overrides,
})

const makePage = (content: StationBookmark[]): GetAllStationBookmarkPaginatedResponse => ({
  content,
  page: 0,
  size: 1000,
  totalElements: content.length,
  totalPages: 1,
})

const networkError = () => new ApiError({ kind: 'network', status: 0, message: '網路連線異常' })

describe('useStationBookmarkStore', () => {
  let pinia: Pinia

  beforeEach(() => {
    tokenManager.clearAuth()
    vi.mocked(getAllStationBookmarkPaginated).mockReset()
    vi.mocked(createStationBookmark).mockReset()
    vi.mocked(deleteStationBookmark).mockReset()
    pinia = createTestPinia()
  })

  afterEach(() => {
    releaseTestPinia(pinia)
    tokenManager.clearAuth()
  })

  const login = () => tokenManager.setAccessToken(makeAccessToken())

  // Scenario: 共用請求 —— 多處同時需要書籤，只能打一次 API
  describe('ensureLoaded', () => {
    it('同時呼叫 3 次只打 1 次 API，載入後不再重抓', async () => {
      login()
      const deferred = createDeferred<GetAllStationBookmarkPaginatedResponse>()
      vi.mocked(getAllStationBookmarkPaginated).mockReturnValue(deferred.promise)
      const store = useStationBookmarkStore()
      const results = [store.ensureLoaded(), store.ensureLoaded(), store.ensureLoaded()]
      expect(store.isBookmarksLoading).toBe(true)
      deferred.resolve(makePage([makeBookmark()]))
      await Promise.all(results)
      await store.ensureLoaded()
      expect(getAllStationBookmarkPaginated).toHaveBeenCalledTimes(1)
      expect(getAllStationBookmarkPaginated).toHaveBeenCalledWith({ page: 0, size: 1000 })
      expect(store.hasLoaded).toBe(true)
      expect(store.isBookmarksLoading).toBe(false)
      expect(store.isBookmarked(10)).toBe(true)
      expect(store.isBookmarked(11)).toBe(false)
    })

    // Scenario: 未登入 —— 沒有登入不能打需要驗證的 API
    it('未登入：不打 API', async () => {
      const store = useStationBookmarkStore()
      await store.ensureLoaded()
      expect(getAllStationBookmarkPaginated).not.toHaveBeenCalled()
      expect(store.hasLoaded).toBe(false)
    })

    // Scenario: 失敗重試 —— 失敗不 reject，錯誤放 bookmarksError，下次呼叫重試
    it('失敗時不 reject，錯誤放進 bookmarksError，再呼叫會重試', async () => {
      login()
      const error = networkError()
      vi.mocked(getAllStationBookmarkPaginated)
        .mockRejectedValueOnce(error)
        .mockResolvedValueOnce(makePage([makeBookmark()]))
      const store = useStationBookmarkStore()
      await expect(store.ensureLoaded()).resolves.toBeUndefined()
      expect(store.bookmarksError).toBe(error)
      expect(store.hasLoaded).toBe(false)
      expect(store.isBookmarksLoading).toBe(false)

      await store.ensureLoaded()
      expect(store.bookmarksError).toBeNull()
      expect(store.bookmarks).toHaveLength(1)
      expect(getAllStationBookmarkPaginated).toHaveBeenCalledTimes(2)
    })
  })

  // Scenario: 切換收藏 —— 依目前是否已收藏決定新增或刪除
  describe('toggleBookmark', () => {
    it('未登入：回傳 login-required，不打 API', async () => {
      const store = useStationBookmarkStore()
      await expect(store.toggleBookmark(10)).resolves.toBe('login-required')
      expect(getAllStationBookmarkPaginated).not.toHaveBeenCalled()
      expect(createStationBookmark).not.toHaveBeenCalled()
    })

    it('還沒載入就按收藏：先載入再新增，結果寫進快取', async () => {
      login()
      const created = makeBookmark({ id: 5, stationId: 10 })
      vi.mocked(getAllStationBookmarkPaginated).mockResolvedValue(makePage([]))
      vi.mocked(createStationBookmark).mockResolvedValue(created)
      const store = useStationBookmarkStore()
      await expect(store.toggleBookmark(10)).resolves.toBe('added')
      expect(getAllStationBookmarkPaginated).toHaveBeenCalledTimes(1)
      expect(createStationBookmark).toHaveBeenCalledWith({ stationId: 10 })
      expect(store.bookmarks).toEqual([created])
      expect(store.isBookmarked(10)).toBe(true)
    })

    it('已收藏的車站：刪除並同步移除快取', async () => {
      login()
      const existing = makeBookmark({ id: 7, stationId: 10 })
      vi.mocked(getAllStationBookmarkPaginated).mockResolvedValue(makePage([existing]))
      vi.mocked(deleteStationBookmark).mockResolvedValue({ message: 'ok' })
      const store = useStationBookmarkStore()
      await expect(store.toggleBookmark(10)).resolves.toBe('removed')
      expect(deleteStationBookmark).toHaveBeenCalledWith({ bookmarkId: 7 })
      expect(store.isBookmarked(10)).toBe(false)
    })

    it('載入失敗：reject 載入錯誤，不新增也不刪除', async () => {
      login()
      const error = networkError()
      vi.mocked(getAllStationBookmarkPaginated).mockRejectedValue(error)
      const store = useStationBookmarkStore()
      await expect(store.toggleBookmark(10)).rejects.toBe(error)
      expect(createStationBookmark).not.toHaveBeenCalled()
      expect(deleteStationBookmark).not.toHaveBeenCalled()
      expect(store.isPending(10)).toBe(false)
    })

    // Scenario: 連點 —— 同一站共用進行中的操作，避免後端回「重複收藏」
    it('同一站連點只送一次新增，進行中 isPending 為 true', async () => {
      login()
      const deferred = createDeferred<StationBookmark>()
      vi.mocked(getAllStationBookmarkPaginated).mockResolvedValue(makePage([]))
      vi.mocked(createStationBookmark).mockReturnValue(deferred.promise)
      const store = useStationBookmarkStore()
      const first = store.toggleBookmark(10)
      const second = store.toggleBookmark(10)
      expect(store.isPending(10)).toBe(true)
      expect(store.isPending(11)).toBe(false)
      deferred.resolve(makeBookmark())
      await expect(Promise.all([first, second])).resolves.toEqual(['added', 'added'])
      expect(createStationBookmark).toHaveBeenCalledTimes(1)
      expect(store.isPending(10)).toBe(false)
    })
  })

  // Scenario: 直接新增、刪除 —— 書籤頁、地圖、旅程卡都會直接呼叫
  describe('addBookmark / removeBookmark', () => {
    it('addBookmark 失敗：reject 原錯誤，快取不變', async () => {
      login()
      const error = networkError()
      vi.mocked(createStationBookmark).mockRejectedValue(error)
      const store = useStationBookmarkStore()
      await expect(store.addBookmark(10)).rejects.toBe(error)
      expect(store.bookmarks).toEqual([])
    })

    it('addBookmark 等進行中的載入結束，且不重複寫入已存在的車站', async () => {
      login()
      const deferred = createDeferred<GetAllStationBookmarkPaginatedResponse>()
      vi.mocked(getAllStationBookmarkPaginated).mockReturnValue(deferred.promise)
      vi.mocked(createStationBookmark).mockResolvedValue(makeBookmark({ id: 9, stationId: 10 }))
      const store = useStationBookmarkStore()
      const loading = store.ensureLoaded()
      const adding = store.addBookmark(10)
      expect(createStationBookmark).not.toHaveBeenCalled()
      deferred.resolve(makePage([makeBookmark({ id: 1, stationId: 10 })]))
      await Promise.all([loading, adding])
      expect(createStationBookmark).toHaveBeenCalledTimes(1)
      expect(store.bookmarks).toHaveLength(1)
    })

    it('removeBookmark 同步快取；快取還沒載入也能刪', async () => {
      login()
      vi.mocked(deleteStationBookmark).mockResolvedValue({ message: 'ok' })
      vi.mocked(getAllStationBookmarkPaginated).mockResolvedValue(
        makePage([makeBookmark({ id: 1, stationId: 10 }), makeBookmark({ id: 2, stationId: 11 })]),
      )
      const store = useStationBookmarkStore()
      await expect(store.removeBookmark({ id: 3 })).resolves.toEqual({ message: 'ok' })
      expect(deleteStationBookmark).toHaveBeenCalledWith({ bookmarkId: 3 })
      expect(getAllStationBookmarkPaginated).not.toHaveBeenCalled()

      await store.ensureLoaded()
      await store.removeBookmark({ id: 1 })
      expect(store.bookmarks.map((item) => item.id)).toEqual([2])
    })
  })

  // Scenario: 作廢過期請求 —— 登出後晚到的上一個人的資料不能寫回
  describe('$reset', () => {
    it('$reset 後才回來的載入結果不寫回 store，也不影響新一輪的載入狀態', async () => {
      login()
      const stale = createDeferred<GetAllStationBookmarkPaginatedResponse>()
      vi.mocked(getAllStationBookmarkPaginated).mockReturnValueOnce(stale.promise)
      const store = useStationBookmarkStore()
      const loading = store.ensureLoaded()
      store.$reset()
      expect(store.isBookmarksLoading).toBe(false)

      const fresh = createDeferred<GetAllStationBookmarkPaginatedResponse>()
      vi.mocked(getAllStationBookmarkPaginated).mockReturnValueOnce(fresh.promise)
      const reloading = store.ensureLoaded()
      stale.resolve(makePage([makeBookmark({ username: '上一位使用者' })]))
      await loading
      expect(store.bookmarks).toEqual([])
      expect(store.hasLoaded).toBe(false)
      expect(store.isBookmarksLoading).toBe(true)

      fresh.resolve(makePage([makeBookmark({ id: 2, stationId: 11 })]))
      await reloading
      expect(store.bookmarks.map((item) => item.id)).toEqual([2])
    })

    it('$reset 後才失敗的載入不會把錯誤寫進 store', async () => {
      login()
      const stale = createDeferred<GetAllStationBookmarkPaginatedResponse>()
      vi.mocked(getAllStationBookmarkPaginated).mockReturnValue(stale.promise)
      const store = useStationBookmarkStore()
      const loading = store.ensureLoaded()
      store.$reset()
      stale.reject(networkError())
      await loading
      expect(store.bookmarksError).toBeNull()
    })

    it('$reset 後才回來的新增結果不寫進快取，pending 也一併清空', async () => {
      login()
      const deferred = createDeferred<StationBookmark>()
      vi.mocked(getAllStationBookmarkPaginated).mockResolvedValue(makePage([]))
      vi.mocked(createStationBookmark).mockReturnValue(deferred.promise)
      const store = useStationBookmarkStore()
      const toggling = store.toggleBookmark(10)
      await vi.waitFor(() => expect(createStationBookmark).toHaveBeenCalled())
      store.$reset()
      expect(store.isPending(10)).toBe(false)
      deferred.resolve(makeBookmark())
      await toggling
      expect(store.bookmarks).toEqual([])
    })
  })
})
