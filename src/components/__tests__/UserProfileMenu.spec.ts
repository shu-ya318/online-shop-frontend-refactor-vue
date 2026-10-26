import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Pinia } from 'pinia'
import { createMemoryHistory, type Router } from 'vue-router'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'

import UserProfileMenu from '@/components/header/UserProfileMenu.vue'
import { useNotifyQueue } from '@/composables/notify'
import vuetify from '@/plugins/vuetify'
import { createAppRouter } from '@/router'
import { logout } from '@/services/auth'
import { ApiError } from '@/services/errors'
import { tokenManager } from '@/services/http'
import { getCurrentUser } from '@/services/user'
import { createTestPinia, makeAccessToken, makeUser, releaseTestPinia } from '@/test/testUtils'

vi.mock('@/services/auth')
vi.mock('@/services/user')

let wrapper: VueWrapper | null = null
let pinia: Pinia
let router: Router

async function mountMenu() {
  pinia = createTestPinia()
  router = createAppRouter(createMemoryHistory())
  await router.push({ name: 'home' })
  wrapper = mount(UserProfileMenu, {
    global: { plugins: [pinia, router, vuetify] },
    attachTo: document.body, // 選單用 teleport 畫在 body 底下
  })
  await flushPromises()
}

const menuButton = () => {
  const button = document.querySelector('[data-testid="user-menu-button"]')
  if (!(button instanceof HTMLElement)) throw new Error('找不到使用者選單按鈕')
  return button
}

async function openMenu() {
  menuButton().click()
  await flushPromises()
}

const menuItem = (title: string) =>
  [...document.querySelectorAll<HTMLElement>('[role="menuitem"]')].find((el) =>
    el.textContent?.includes(title),
  )

beforeEach(() => {
  vi.mocked(getCurrentUser).mockResolvedValue(makeUser({ username: '王小明' }))
  useNotifyQueue().value = []
})
afterEach(() => {
  wrapper?.unmount()
  wrapper = null
  releaseTestPinia(pinia)
  tokenManager.clearAuth()
  vi.restoreAllMocks()
  vi.mocked(logout).mockReset()
  vi.mocked(getCurrentUser).mockReset()
})

describe('UserProfileMenu', () => {
  it('觸發按鈕是有名稱的 button，方向鍵可以打開，項目是 menuitem', async () => {
    await mountMenu()
    const button = menuButton()
    expect(button.tagName).toBe('BUTTON')
    expect(button.getAttribute('aria-label')).toBe('使用者選單')
    button.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }))
    await flushPromises()
    expect(document.querySelector('[role="menu"]')).not.toBeNull()
    expect(menuItem('登入')).toBeDefined()
  })

  it('登出：呼叫 API、清掉登入狀態、導到登入頁並顯示成功訊息', async () => {
    tokenManager.setAccessToken(makeAccessToken())
    vi.mocked(logout).mockResolvedValue()
    await mountMenu()
    await vi.waitFor(() =>
      expect(menuButton().getAttribute('aria-label')).toBe('王小明 的使用者選單'),
    )
    await openMenu()
    menuItem('登出')?.click()
    await flushPromises()
    expect(logout).toHaveBeenCalledTimes(1)
    expect(tokenManager.getAccessToken()).toBeNull()
    // 第一次導到登入頁要動態載入 LoginView，給長一點的時間
    await vi.waitFor(() => expect(router.currentRoute.value.name).toBe('login'), { timeout: 5000 })
    expect(useNotifyQueue().value).toEqual([
      expect.objectContaining({ color: 'success', text: '登出成功!' }),
    ])
  })

  it('登出 API 失敗：本機一樣登出，顯示警告', async () => {
    tokenManager.setAccessToken(makeAccessToken())
    vi.mocked(logout).mockRejectedValue(
      new ApiError({ kind: 'network', status: 0, message: '網路連線異常，請檢查網路後再試' }),
    )
    await mountMenu()
    await openMenu()
    menuItem('登出')?.click()
    await flushPromises()
    expect(tokenManager.getAccessToken()).toBeNull()
    await vi.waitFor(() => expect(router.currentRoute.value.name).toBe('login'))
    expect(useNotifyQueue().value).toEqual([
      expect.objectContaining({
        color: 'warning',
        text: '已在這個裝置登出，但伺服器沒有回應：網路連線異常，請檢查網路後再試',
      }),
    ])
  })
})
