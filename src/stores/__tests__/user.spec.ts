import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Pinia } from 'pinia'

import { useUserStore } from '@/stores/user'
import { tokenManager } from '@/services/http'
import { getCurrentUser } from '@/services/user'
import { ApiError } from '@/services/errors'
import { UserRole } from '@/services/user/types'
import type { CurrentUser } from '@/services/user/interface'
import {
  createDeferred,
  createTestPinia,
  makeAccessToken,
  makeUser,
  releaseTestPinia,
} from '@/test/testUtils'

vi.mock('@/services/user')

const networkError = () => new ApiError({ kind: 'network', status: 0, message: '網路連線異常' })

describe('useUserStore', () => {
  let pinia: Pinia

  beforeEach(() => {
    tokenManager.clearAuth()
    vi.mocked(getCurrentUser).mockReset()
    pinia = createTestPinia()
  })

  afterEach(() => {
    releaseTestPinia(pinia)
    tokenManager.clearAuth()
  })

  // Scenario: 共用請求 —— 登入後多處同時需要使用者資料，只能打一次 API
  describe('ensureUser', () => {
    it('同時呼叫 3 次只打 1 次 API，三個呼叫拿到同一個使用者', async () => {
      tokenManager.setAccessToken(makeAccessToken())
      const deferred = createDeferred<CurrentUser>()
      vi.mocked(getCurrentUser).mockReturnValue(deferred.promise)
      const user = useUserStore()
      // 登入後：LoginPage、路由守衛、設定頁幾乎同時需要使用者資料（React 版各抓一次）
      const results = [user.ensureUser(), user.ensureUser(), user.ensureUser()]
      deferred.resolve(makeUser())
      const users = await Promise.all(results)
      expect(getCurrentUser).toHaveBeenCalledTimes(1)
      expect(users.map((item) => item?.username)).toEqual(['王小明', '王小明', '王小明'])
      expect(user.userInfo?.username).toBe('王小明')
    })

    // Scenario: 已有資料 —— 再呼叫直接回傳快取
    it('已經有使用者資料：不再打 API', async () => {
      tokenManager.setAccessToken(makeAccessToken())
      vi.mocked(getCurrentUser).mockResolvedValue(makeUser())
      const user = useUserStore()
      await user.ensureUser()
      const again = await user.ensureUser()
      expect(again?.username).toBe('王小明')
      expect(getCurrentUser).toHaveBeenCalledTimes(1)
    })

    // Scenario: 未登入 —— 沒有 token 不能打需要驗證的 API
    it('沒有 token：回傳 null，不打 API', async () => {
      const user = useUserStore()
      await expect(user.ensureUser()).resolves.toBeNull()
      expect(getCurrentUser).not.toHaveBeenCalled()
      expect(user.userInfo).toBeNull()
    })

    // Scenario: 失敗重試 —— 失敗不能把失敗的 Promise 永遠留著
    it('失敗時 reject 原錯誤，下次呼叫會重新抓', async () => {
      tokenManager.setAccessToken(makeAccessToken())
      const error = networkError()
      vi.mocked(getCurrentUser).mockRejectedValueOnce(error).mockResolvedValueOnce(makeUser())
      const user = useUserStore()
      await expect(user.ensureUser()).rejects.toBe(error)
      expect(user.userInfo).toBeNull()
      const retried = await user.ensureUser()
      expect(retried?.username).toBe('王小明')
      expect(getCurrentUser).toHaveBeenCalledTimes(2)
    })
  })

  // Scenario: 角色判斷 —— isAdmin 只看後端回傳的 role，不解 JWT
  describe('isAdmin', () => {
    it('依 userInfo.role 判斷，不看 JWT 內容', async () => {
      // token 內不含任何 role 資訊；角色完全來自 get-current-user
      tokenManager.setAccessToken(makeAccessToken())
      const user = useUserStore()
      expect(user.isAdmin).toBe(false)

      vi.mocked(getCurrentUser).mockResolvedValueOnce(makeUser({ role: UserRole.ADMIN }))
      await user.ensureUser()
      expect(user.isAdmin).toBe(true)

      vi.mocked(getCurrentUser).mockResolvedValueOnce(makeUser({ role: UserRole.USER }))
      await user.refreshUser()
      expect(user.isAdmin).toBe(false)
    })
  })

  // Scenario: 作廢過期請求 —— 登出後晚到的上一個人的資料不能寫回
  describe('$reset', () => {
    it('$reset 後才回來的回應不寫回 store', async () => {
      tokenManager.setAccessToken(makeAccessToken())
      const deferred = createDeferred<CurrentUser>()
      vi.mocked(getCurrentUser).mockReturnValue(deferred.promise)
      const user = useUserStore()
      const result = user.ensureUser()
      user.$reset()
      deferred.resolve(makeUser({ username: '上一位使用者' }))
      await expect(result).resolves.toBeNull()
      expect(user.userInfo).toBeNull()
    })

    it('$reset 清空資料，之後 ensureUser 會重新抓', async () => {
      tokenManager.setAccessToken(makeAccessToken())
      vi.mocked(getCurrentUser).mockResolvedValue(makeUser())
      const user = useUserStore()
      await user.ensureUser()
      user.$reset()
      expect(user.userInfo).toBeNull()
      await user.ensureUser()
      expect(getCurrentUser).toHaveBeenCalledTimes(2)
    })
  })

  // Scenario: 強制重抓 —— 新請求取代進行中的舊請求，舊回應不能蓋掉新資料
  describe('refreshUser', () => {
    it('取代進行中的請求：舊回應晚到不會蓋掉新資料', async () => {
      tokenManager.setAccessToken(makeAccessToken())
      const first = createDeferred<CurrentUser>()
      const second = createDeferred<CurrentUser>()
      vi.mocked(getCurrentUser)
        .mockReturnValueOnce(first.promise)
        .mockReturnValueOnce(second.promise)
      const user = useUserStore()
      const ensured = user.ensureUser()
      const refreshed = user.refreshUser()
      second.resolve(makeUser({ username: '新資料' }))
      await refreshed
      first.resolve(makeUser({ username: '舊資料' }))
      await ensured
      expect(getCurrentUser).toHaveBeenCalledTimes(2)
      expect(user.userInfo?.username).toBe('新資料')
    })

    it('沒有 token：回傳 null，不打 API', async () => {
      const user = useUserStore()
      await expect(user.refreshUser()).resolves.toBeNull()
      expect(getCurrentUser).not.toHaveBeenCalled()
    })
  })

  // Scenario: 局部更新 —— 修改 API 只回異動欄位，合併回目前資料
  describe('patchUser', () => {
    it('合併異動欄位；尚無資料時不建立半套使用者', async () => {
      tokenManager.setAccessToken(makeAccessToken())
      const user = useUserStore()
      user.patchUser({ username: '不該出現' })
      expect(user.userInfo).toBeNull()

      vi.mocked(getCurrentUser).mockResolvedValue(makeUser())
      await user.ensureUser()
      user.patchUser({ username: '王大明' })
      expect(user.userInfo?.username).toBe('王大明')
      expect(user.userInfo?.email).toBe('ming@example.com')
    })
  })
})
