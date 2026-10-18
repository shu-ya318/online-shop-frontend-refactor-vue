import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Pinia } from 'pinia'

import { useAuthStore } from '@/stores/auth'
import { useUserStore } from '@/stores/user'
import { useStationBookmarkStore } from '@/stores/stationBookmark'
import { tokenManager } from '@/services/http'
import { login, logout, signup } from '@/services/auth'
import { getCurrentUser } from '@/services/user'
import { getAllStationBookmarkPaginated } from '@/services/stationBookmark'
import { ApiError } from '@/services/errors'
import {
  createDeferred,
  createTestPinia,
  makeAccessToken,
  makeUser,
  releaseTestPinia,
} from '@/test/testUtils'

vi.mock('@/services/auth')
vi.mock('@/services/user')
vi.mock('@/services/stationBookmark')

const credentials = { email: 'ming@example.com', password: 'password123' }

/** 模擬已登入且 user、書籤 store 都有資料的狀態 */
const seedLoggedInUser = async () => {
  tokenManager.setAccessToken(makeAccessToken('old'))
  vi.mocked(getCurrentUser).mockResolvedValue(makeUser())
  vi.mocked(getAllStationBookmarkPaginated).mockResolvedValue({
    content: [
      {
        id: 10,
        stationId: 1,
        stationNameZhTw: '台北車站',
        stationNameEn: 'Taipei Main Station',
        userId: 1,
        username: '王小明',
        email: 'ming@example.com',
        createdAt: '2026-01-01T00:00:00',
      },
    ],
    page: 0,
    size: 1000,
    totalElements: 1,
    totalPages: 1,
  })
  const user = useUserStore()
  const bookmarks = useStationBookmarkStore()
  await user.ensureUser()
  await bookmarks.ensureLoaded()
  return { user, bookmarks }
}

describe('useAuthStore', () => {
  let pinia: Pinia

  beforeEach(() => {
    tokenManager.clearAuth()
    vi.mocked(login).mockReset()
    vi.mocked(logout).mockReset()
    vi.mocked(signup).mockReset()
    vi.mocked(getCurrentUser).mockReset()
    vi.mocked(getAllStationBookmarkPaginated).mockReset()
    pinia = createTestPinia()
  })

  afterEach(() => {
    releaseTestPinia(pinia)
    tokenManager.clearAuth()
  })

  // Scenario: 登入狀態 —— isAuthenticated 的唯一來源是 tokenManager
  it('isAuthenticated 跟著 tokenManager 的 token 變化', () => {
    const auth = useAuthStore()
    expect(auth.isAuthenticated).toBe(false)
    expect(auth.accessToken).toBeNull()

    const token = makeAccessToken()
    tokenManager.setAccessToken(token)
    expect(auth.isAuthenticated).toBe(true)
    expect(auth.accessToken).toBe(token)

    tokenManager.clearAuth()
    expect(auth.isAuthenticated).toBe(false)
  })

  // Scenario: 登入 —— 換帳號時不能看到上一個帳號的資料
  describe('login / signup', () => {
    it('login 成功：寫入 token，並清掉上一個帳號的使用者與書籤', async () => {
      const { user, bookmarks } = await seedLoggedInUser()
      const newToken = makeAccessToken('new')
      vi.mocked(login).mockResolvedValue({ accessToken: newToken, refreshToken: '' })
      await useAuthStore().login(credentials)
      expect(login).toHaveBeenCalledWith(credentials)
      expect(tokenManager.getAccessToken()).toBe(newToken)
      expect(user.userInfo).toBeNull()
      expect(bookmarks.bookmarks).toEqual([])
      expect(bookmarks.hasLoaded).toBe(false)
    })

    // Scenario: 登入失敗 —— 不能動到既有狀態
    it('login 失敗：reject 原錯誤，不寫入 token', async () => {
      const error = new ApiError({ kind: 'http', status: 401, message: '帳號或密碼錯誤' })
      vi.mocked(login).mockRejectedValue(error)
      const auth = useAuthStore()
      await expect(auth.login(credentials)).rejects.toBe(error)
      expect(tokenManager.getAccessToken()).toBeNull()
      expect(auth.isAuthenticated).toBe(false)
    })

    it('signup 成功：寫入 token 並開始新工作階段', async () => {
      const { user } = await seedLoggedInUser()
      const newToken = makeAccessToken('signup')
      vi.mocked(signup).mockResolvedValue({ accessToken: newToken, refreshToken: '' })
      await useAuthStore().signup({
        ...credentials,
        username: '王小明',
        cellphone: '0912345678',
      })
      expect(tokenManager.getAccessToken()).toBe(newToken)
      expect(user.userInfo).toBeNull()
    })
  })

  // Scenario: 登出 —— 本機一律登出，後端成功與否只影響回傳結果
  describe('logout', () => {
    it('API 成功：清 token、重設使用者與書籤 store', async () => {
      const { user, bookmarks } = await seedLoggedInUser()
      vi.mocked(logout).mockResolvedValue(undefined)
      const result = await useAuthStore().logout()
      expect(result).toEqual({ serverLoggedOut: true })
      expect(tokenManager.getAccessToken()).toBeNull()
      expect(useAuthStore().isAuthenticated).toBe(false)
      expect(user.userInfo).toBeNull()
      expect(user.isAdmin).toBe(false)
      expect(bookmarks.bookmarks).toEqual([])
      expect(bookmarks.hasLoaded).toBe(false)
    })

    it('API 失敗：仍然清 token 並重設 store，回傳 serverLoggedOut: false 與錯誤', async () => {
      const { user, bookmarks } = await seedLoggedInUser()
      const error = new ApiError({ kind: 'network', status: 0, message: '網路連線異常' })
      vi.mocked(logout).mockRejectedValue(error)
      const result = await useAuthStore().logout()
      expect(result).toEqual({ serverLoggedOut: false, error })
      expect(tokenManager.getAccessToken()).toBeNull()
      expect(user.userInfo).toBeNull()
      expect(bookmarks.hasLoaded).toBe(false)
    })

    it('呼叫 API 時 token 還在（後端要把它列入黑名單），回應後才清掉', async () => {
      const token = makeAccessToken()
      tokenManager.setAccessToken(token)
      let tokenDuringRequest: string | null = 'not-called'
      vi.mocked(logout).mockImplementation(async () => {
        tokenDuringRequest = tokenManager.getAccessToken()
      })
      await useAuthStore().logout()
      expect(tokenDuringRequest).toBe(token)
      expect(tokenManager.getAccessToken()).toBeNull()
    })

    it('連點兩次只送一次 API，兩次拿到同一個結果；結束後可再登出', async () => {
      tokenManager.setAccessToken(makeAccessToken())
      const deferred = createDeferred<void>()
      vi.mocked(logout).mockReturnValue(deferred.promise)
      const auth = useAuthStore()
      const first = auth.logout()
      const second = auth.logout()
      deferred.resolve()
      const results = await Promise.all([first, second])
      expect(logout).toHaveBeenCalledTimes(1)
      expect(results[0]).toBe(results[1])

      vi.mocked(logout).mockResolvedValue(undefined)
      await auth.logout()
      expect(logout).toHaveBeenCalledTimes(2)
    })
  })
})
