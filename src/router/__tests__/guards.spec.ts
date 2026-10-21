import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Pinia } from 'pinia'
import {
  createMemoryHistory,
  createRouter,
  isNavigationFailure,
  type RouteRecordRaw,
  type Router,
} from 'vue-router'

import { notify } from '@/composables/notify'
import { authGuard, titleHook } from '@/router/guards'
import { routes } from '@/router/routes'
import { ApiError } from '@/services/errors'
import { tokenManager } from '@/services/http'
import { getCurrentUser } from '@/services/user'
import { UserRole } from '@/services/user/types'
import { useUserStore } from '@/stores/user'
import { createTestPinia, makeAccessToken, makeUser, releaseTestPinia } from '@/test/testUtils'

vi.mock('@/services/user')
// 路由表會 import 版型；測試只看守衛，不需要真的載入 .vue
vi.mock('@/layouts/AuthLayout.vue', () => ({ default: {} }))
vi.mock('@/layouts/MainLayout.vue', () => ({ default: {} }))

const networkError = () => new ApiError({ kind: 'network', status: 0, message: '網路連線異常' })
const unauthorizedError = () => new ApiError({ kind: 'http', status: 401, message: '登入已失效' })

const Stub = { render: () => null }

/** 保留真實的 path / name / meta / redirect，只把 component 換成空殼，避免載入版型與頁面 */
const stubRoutes = (list: RouteRecordRaw[]): RouteRecordRaw[] =>
  list.map((route) => {
    const { component, children, ...rest } = route
    const base = { ...rest, ...(component ? { component: Stub } : {}) }
    return (children ? { ...base, children: stubRoutes(children) } : base) as RouteRecordRaw
  })

describe('authGuard / titleHook', () => {
  let pinia: Pinia
  let router: Router

  const current = () => router.currentRoute.value

  beforeEach(() => {
    tokenManager.clearAuth()
    vi.mocked(getCurrentUser).mockReset()
    pinia = createTestPinia()
    router = createRouter({ history: createMemoryHistory(), routes: stubRoutes(routes) })
    router.beforeEach(authGuard)
    router.afterEach(titleHook)
  })

  afterEach(() => {
    vi.restoreAllMocks()
    releaseTestPinia(pinia)
    tokenManager.clearAuth()
  })

  // Scenario: 未登入 —— 需要登入的頁面導到登入頁並帶原網址，公開頁與 404 照常顯示
  describe('未登入', () => {
    it('進需要登入的頁面：導到登入頁並帶 redirect', async () => {
      await router.push('/trip-planner?day=2')
      expect(current().name).toBe('login')
      expect(current().query.redirect).toBe('/trip-planner?day=2')
      expect(getCurrentUser).not.toHaveBeenCalled()
    })

    it('進管理頁：導到登入頁', async () => {
      await router.push('/admin/user-management')
      expect(current().name).toBe('login')
      expect(current().query.redirect).toBe('/admin/user-management')
    })

    it('進公開頁：直接放行', async () => {
      await router.push('/metro-map')
      expect(current().name).toBe('metro-map')
    })

    it('不存在的網址：顯示 404 頁', async () => {
      await router.push('/no-such-page')
      expect(current().name).toBe('not-found')
    })
  })

  // Scenario: 權限 —— 一般使用者與管理員進管理頁
  describe('已登入進管理頁', () => {
    it('一般使用者：導到 /unauthorized', async () => {
      tokenManager.setAccessToken(makeAccessToken())
      vi.mocked(getCurrentUser).mockResolvedValue(makeUser({ role: UserRole.USER }))
      await router.push('/admin/user-management')
      expect(current().name).toBe('not-authorized')
    })

    it('管理員：放行', async () => {
      tokenManager.setAccessToken(makeAccessToken())
      vi.mocked(getCurrentUser).mockResolvedValue(makeUser({ role: UserRole.ADMIN }))
      await router.push('/admin/user-management')
      expect(current().name).toBe('admin-user-management')
    })
  })

  // Scenario: 確認身分失敗 —— 網路錯誤不等於沒權限，401 才是登入失效
  describe('ensureUser 失敗時', () => {
    it('網路錯誤 + 管理頁（從別頁點過來）：不判定為沒權限，停在原頁並顯示錯誤', async () => {
      const notifyError = vi.spyOn(notify, 'error')
      tokenManager.setAccessToken(makeAccessToken())
      vi.mocked(getCurrentUser).mockRejectedValue(networkError())
      await router.push('/home')
      const failure = await router.push('/admin/user-management')
      expect(isNavigationFailure(failure)).toBe(true)
      expect(current().name).toBe('home')
      expect(notifyError).toHaveBeenCalledWith(expect.stringContaining('無法確認管理員權限'))
      // token 沒有被清掉：網路錯誤不是登入失效
      expect(tokenManager.getAccessToken()).not.toBeNull()
    })

    it('網路錯誤 + 管理頁（直接開網址）：改去首頁，不是 /unauthorized', async () => {
      vi.spyOn(notify, 'error')
      tokenManager.setAccessToken(makeAccessToken())
      vi.mocked(getCurrentUser).mockRejectedValue(networkError())
      await router.push('/admin/user-management')
      expect(current().name).toBe('home')
    })

    it('網路錯誤 + 一般需登入頁：先放行，由頁面自己的 API 顯示錯誤', async () => {
      tokenManager.setAccessToken(makeAccessToken())
      vi.mocked(getCurrentUser).mockRejectedValue(networkError())
      await router.push('/user-setting')
      expect(current().name).toBe('user-setting')
    })

    it('401：導到登入頁並帶 redirect', async () => {
      tokenManager.setAccessToken(makeAccessToken())
      vi.mocked(getCurrentUser).mockRejectedValue(unauthorizedError())
      await router.push('/user-setting')
      expect(current().name).toBe('login')
      expect(current().query.redirect).toBe('/user-setting')
    })

    it('等待期間 token 被清掉（拿不到使用者）：導到登入頁', async () => {
      tokenManager.setAccessToken(makeAccessToken())
      vi.mocked(getCurrentUser).mockImplementation(async () => {
        await Promise.resolve()
        // 登入失效 → 清 token 並重設 user-scoped store（晚到的回應不再寫入）
        tokenManager.clearAuth()
        useUserStore().$reset()
        return makeUser()
      })
      await router.push('/user-setting')
      expect(current().name).toBe('login')
    })
  })

  // Scenario: 訪客頁 —— 已登入的人不該停在登入頁，redirect 只接受站內路徑
  describe('已登入開登入頁', () => {
    beforeEach(() => {
      tokenManager.setAccessToken(makeAccessToken())
      vi.mocked(getCurrentUser).mockResolvedValue(makeUser())
    })

    it('有站內 redirect：導過去', async () => {
      await router.push('/auth/login?redirect=/station-bookmark')
      expect(current().name).toBe('station-bookmark')
    })

    it('沒有 redirect：導到首頁', async () => {
      await router.push('/auth/login')
      expect(current().name).toBe('home')
    })

    it.each(['https://evil.com', '//evil.com', '/\\evil.com'])(
      '外部 redirect（%s）：改去首頁',
      async (redirect) => {
        await router.push({ name: 'login', query: { redirect } })
        expect(current().name).toBe('home')
      },
    )

    it('確認身分失敗：留在登入頁重新登入', async () => {
      vi.mocked(getCurrentUser).mockRejectedValue(networkError())
      await router.push('/auth/login')
      expect(current().name).toBe('login')
    })
  })

  // Scenario: 公開頁背景載入 —— Header 要顯示使用者，但不擋導覽、失敗不影響
  describe('公開頁、有 token', () => {
    it('背景載入使用者資料，不等它就放行', async () => {
      tokenManager.setAccessToken(makeAccessToken())
      vi.mocked(getCurrentUser).mockReturnValue(new Promise(() => {}))
      await router.push('/metro-map')
      expect(current().name).toBe('metro-map')
      expect(getCurrentUser).toHaveBeenCalledTimes(1)
    })

    it('背景載入失敗：照樣放行', async () => {
      tokenManager.setAccessToken(makeAccessToken())
      vi.mocked(getCurrentUser).mockRejectedValue(networkError())
      await router.push('/metro-map')
      expect(current().name).toBe('metro-map')
    })
  })

  // Scenario: 分頁標題 —— 依 meta.title 設定，導覽失敗不改
  describe('titleHook', () => {
    it('有 meta.title：「標題 - lookGo」', async () => {
      await router.push('/metro-map')
      expect(document.title).toBe('捷運地圖 - lookGo')
    })

    it('導覽被取消：不改標題', async () => {
      vi.spyOn(notify, 'error')
      tokenManager.setAccessToken(makeAccessToken())
      vi.mocked(getCurrentUser).mockRejectedValue(networkError())
      await router.push('/home')
      await router.push('/admin/user-management')
      expect(document.title).toBe('首頁 - lookGo')
    })

    it('沒有 meta.title：只顯示 lookGo', async () => {
      const bare = createRouter({
        history: createMemoryHistory(),
        routes: [{ path: '/', component: Stub }],
      })
      bare.afterEach(titleHook)
      await bare.push('/')
      expect(document.title).toBe('lookGo')
    })
  })
})
