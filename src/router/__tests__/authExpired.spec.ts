import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, type Pinia } from 'pinia'
import { createMemoryHistory, createRouter, type Router } from 'vue-router'

import { useNotifyQueue } from '@/composables/notify'
import { installAuthExpiredHandler } from '@/router/authExpired'
import { setOnAuthExpired } from '@/services/http'
import { resetUserScopedStores } from '@/stores/plugins/userScoped'

// 只測「登入失效時要做的事」：攔下註冊的處理函式自己呼叫，不經過真的 token 刷新
vi.mock('@/services/http', () => ({
  setOnAuthExpired: vi.fn<(handler: (() => void) | null) => void>(),
}))
vi.mock('@/stores/plugins/userScoped', () => ({
  resetUserScopedStores: vi.fn<(pinia?: Pinia) => void>(),
}))

const Stub = { render: () => null }

/** 取出 installAuthExpiredHandler 註冊的處理函式 */
const registeredHandler = (): (() => void) => {
  const handler = vi.mocked(setOnAuthExpired).mock.calls.at(-1)?.[0]
  if (!handler) throw new Error('沒有註冊登入失效的處理函式')
  return handler
}

describe('installAuthExpiredHandler', () => {
  let router: Router
  let pinia: Pinia

  beforeEach(async () => {
    pinia = createPinia()
    router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/auth/login', name: 'login', component: Stub },
        { path: '/home', name: 'home', component: Stub },
        {
          path: '/user-setting',
          name: 'user-setting',
          component: Stub,
          meta: { requiresAuth: true },
        },
      ],
    })
    useNotifyQueue().value = []
    installAuthExpiredHandler(router, pinia)
  })

  afterEach(() => {
    vi.mocked(setOnAuthExpired).mockReset()
    vi.mocked(resetUserScopedStores).mockReset()
  })

  it('需要登入的頁面：重設使用者資料、提示，並導到登入頁帶 redirect', async () => {
    await router.push('/user-setting?tab=password')
    registeredHandler()()
    await vi.waitFor(() => expect(router.currentRoute.value.name).toBe('login'))
    expect(router.currentRoute.value.query.redirect).toBe('/user-setting?tab=password')
    expect(resetUserScopedStores).toHaveBeenCalledWith(pinia)
    expect(useNotifyQueue().value).toEqual([
      expect.objectContaining({ color: 'warning', text: '登入已失效，請重新登入' }),
    ])
  })

  it('公開頁：只重設與提示，留在原頁', async () => {
    await router.push('/home')
    registeredHandler()()
    await Promise.resolve()
    expect(router.currentRoute.value.name).toBe('home')
    expect(resetUserScopedStores).toHaveBeenCalledWith(pinia)
    expect(useNotifyQueue().value).toHaveLength(1)
  })
})
