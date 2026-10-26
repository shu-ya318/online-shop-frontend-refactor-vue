import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'

import { fillField, getDescription, getInputByLabel, pressEnter } from '@/__tests__/formTestUtils'
import { useNotifyQueue } from '@/composables/notify'
import { login } from '@/services/auth'
import type { AuthResponse } from '@/services/auth/interface'
import { ApiError } from '@/services/errors'
import { getCurrentUser } from '@/services/user'
import { createDeferred, makeAccessToken, makeUser } from '@/test/testUtils'
import LoginView from '@/views/auth/LoginView.vue'
import { mountAuthPage, unmountAuthPage, waitForRoute } from '@/views/auth/__tests__/authPageSetup'

vi.mock('@/services/auth')
// 登入後導到首頁，守衛會在背景抓使用者資料
vi.mock('@/services/user')

const authResponse = (): AuthResponse => ({
  accessToken: makeAccessToken(),
  refreshToken: 'refresh-token',
})

const mountLogin = (query: Record<string, string> = {}) =>
  mountAuthPage(LoginView, { name: 'login', query }, '登入')

async function fillValidForm() {
  await fillField('電子郵件', 'ming@example.com')
  await fillField('密碼', 'password1')
}

beforeEach(() => {
  vi.mocked(getCurrentUser).mockResolvedValue(makeUser())
  useNotifyQueue().value = []
})
afterEach(() => {
  unmountAuthPage()
  vi.mocked(login).mockReset()
  vi.mocked(getCurrentUser).mockReset()
})

describe('LoginView', () => {
  it('畫面：標題、兩個欄位都有 label，註冊連結會帶著 redirect', async () => {
    await mountLogin({ redirect: '/metro-map' })
    expect(document.querySelector('h1')?.textContent).toBe('歡迎您回來')
    expect(getInputByLabel('電子郵件').getAttribute('aria-required')).toBe('true')
    expect(getInputByLabel('密碼').type).toBe('password')
    const signupLink = [...document.querySelectorAll('a')].find((a) =>
      a.textContent?.includes('點此註冊'),
    )
    expect(signupLink?.getAttribute('href')).toBe('/auth/signup?redirect=/metro-map')
  })

  it('什麼都沒填就送出：每個欄位顯示錯誤、焦點移到第一個錯誤欄位，不呼叫 API', async () => {
    const page = await mountLogin()
    await page.clickSubmit()
    const email = getInputByLabel('電子郵件')
    expect(getDescription(email)).toBe('請輸入有效格式的電子郵件!')
    expect(getDescription(getInputByLabel('密碼'))).toBe('請輸入密碼!')
    expect(document.activeElement).toBe(email)
    expect(login).not.toHaveBeenCalled()
  })

  it('登入成功：送出表單的值、導到首頁並顯示成功訊息', async () => {
    vi.mocked(login).mockResolvedValue(authResponse())
    const page = await mountLogin()
    await fillValidForm()
    await page.clickSubmit()
    expect(login).toHaveBeenCalledWith({ email: 'ming@example.com', password: 'password1' })
    await waitForRoute(page.router, 'home')
    expect(useNotifyQueue().value).toEqual([
      expect.objectContaining({ color: 'success', text: '登入成功，歡迎回來' }),
    ])
  })

  it('有 ?redirect=：登入後回到原本要去的站內頁面；外部網址一律改去首頁', async () => {
    vi.mocked(login).mockResolvedValue(authResponse())
    const page = await mountLogin({ redirect: '/metro-map' })
    await fillValidForm()
    await page.clickSubmit()
    await waitForRoute(page.router, 'metro-map')
    expect(page.router.currentRoute.value.fullPath).toBe('/metro-map')
    unmountAuthPage()

    const evil = await mountLogin({ redirect: 'https://evil.example.com' })
    await fillValidForm()
    await evil.clickSubmit()
    await waitForRoute(evil.router, 'home')
    expect(evil.router.currentRoute.value.fullPath).toBe('/home')
  })

  it('帳密錯誤（沒有欄位錯誤）：訊息顯示在送出按鈕上方，留在登入頁', async () => {
    vi.mocked(login).mockRejectedValue(
      new ApiError({ kind: 'http', status: 401, message: '電子郵件或密碼錯誤!' }),
    )
    const page = await mountLogin()
    await fillValidForm()
    await page.clickSubmit()
    expect(page.formAlert()?.textContent).toContain('電子郵件或密碼錯誤!')
    expect(page.router.currentRoute.value.name).toBe('login')
  })

  it('後端回傳欄位錯誤（{欄位: 訊息}）：顯示在該欄位下方、焦點移過去，沒有整體錯誤', async () => {
    vi.mocked(login).mockRejectedValue(
      new ApiError({
        kind: 'http',
        status: 400,
        message: '密碼長度必須為 8-20 個字元!',
        fieldErrors: { password: '密碼長度必須為 8-20 個字元!' },
      }),
    )
    const page = await mountLogin()
    await fillValidForm()
    await page.clickSubmit()
    const password = getInputByLabel('密碼')
    expect(getDescription(password)).toBe('密碼長度必須為 8-20 個字元!')
    expect(password.getAttribute('aria-invalid')).toBe('true')
    expect(document.activeElement).toBe(password)
    expect(page.formAlert()).toBeNull()
    expect(page.router.currentRoute.value.name).toBe('login')
  })

  it('防重複送出：送出中再按一次或再按 Enter，API 只呼叫一次；按鈕顯示讀取中', async () => {
    const deferred = createDeferred<AuthResponse>()
    vi.mocked(login).mockReturnValue(deferred.promise)
    const page = await mountLogin()
    await fillValidForm()
    await page.clickSubmit()
    await page.clickSubmit()
    pressEnter(getInputByLabel('密碼'))
    await flushPromises()
    expect(login).toHaveBeenCalledTimes(1)
    expect(page.submitButton().getAttribute('aria-busy')).toBe('true')
    deferred.resolve(authResponse())
    await waitForRoute(page.router, 'home')
    expect(page.submitButton().hasAttribute('aria-busy')).toBe(false)
  })

  it('注音輸入法：組字中按 Enter 不送出；選完字後按 Enter 才送出', async () => {
    vi.mocked(login).mockResolvedValue(authResponse())
    await mountLogin()
    await fillValidForm()
    const password = getInputByLabel('密碼')
    const composing = pressEnter(password, { isComposing: true })
    const safariCommit = pressEnter(password, { keyCode: 229 }) // Safari：結束組字的 Enter
    await flushPromises()
    expect(composing.defaultPrevented).toBe(true)
    expect(safariCommit.defaultPrevented).toBe(true)
    expect(login).not.toHaveBeenCalled()
    const normal = pressEnter(password)
    await flushPromises()
    expect(normal.defaultPrevented).toBe(false)
    expect(login).toHaveBeenCalledTimes(1)
  })
})
