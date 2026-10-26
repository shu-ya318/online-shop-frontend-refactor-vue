import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { fillField, getDescription, getInputByLabel } from '@/__tests__/formTestUtils'
import { useNotifyQueue } from '@/composables/notify'
import { signup } from '@/services/auth'
import { ApiError } from '@/services/errors'
import { getCurrentUser } from '@/services/user'
import { makeAccessToken, makeUser } from '@/test/testUtils'
import SignupView from '@/views/auth/SignupView.vue'
import { mountAuthPage, unmountAuthPage, waitForRoute } from '@/views/auth/__tests__/authPageSetup'

vi.mock('@/services/auth')
// 註冊後導到首頁，守衛會在背景抓使用者資料
vi.mock('@/services/user')

const mountSignup = () => mountAuthPage(SignupView, { name: 'signup' }, '註冊')

async function fillRequired() {
  await fillField('電子郵件', 'ming@example.com')
  await fillField('使用者名稱', '王小明')
  await fillField('手機號碼', '0912345678')
  await fillField('密碼', 'password1')
}

beforeEach(() => {
  // 只固定「今天」（2024-06-15），不動計時器：Vuetify 與 flushPromises 還要正常運作
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2024, 5, 15, 12, 0, 0))
  vi.mocked(signup).mockResolvedValue({ accessToken: makeAccessToken(), refreshToken: 'r' })
  vi.mocked(getCurrentUser).mockResolvedValue(makeUser())
  useNotifyQueue().value = []
})
afterEach(() => {
  unmountAuthPage()
  vi.useRealTimers()
  vi.mocked(signup).mockReset()
  vi.mocked(getCurrentUser).mockReset()
})

describe('SignupView', () => {
  it('必填欄位沒填就送出：顯示錯誤；出生日期是選填，不顯示錯誤', async () => {
    const page = await mountSignup()
    await page.clickSubmit()
    expect(getDescription(getInputByLabel('電子郵件'))).toBe('請輸入有效格式的電子郵件!')
    expect(getDescription(getInputByLabel('使用者名稱'))).toBe('請輸入使用者名稱!')
    expect(getDescription(getInputByLabel('手機號碼'))).toBe('請輸入手機號碼!')
    expect(getDescription(getInputByLabel('密碼'))).toBe('請輸入密碼!')
    const birthDate = getInputByLabel('出生日期')
    expect(birthDate.hasAttribute('aria-invalid')).toBe(false)
    expect(birthDate.hasAttribute('aria-required')).toBe(false)
    expect(signup).not.toHaveBeenCalled()
  })

  it('出生日期的可選範圍是 6～150 歲', async () => {
    await mountSignup()
    const birthDate = getInputByLabel('出生日期')
    expect(birthDate.type).toBe('date')
    expect(birthDate.min).toBe('1874-06-15')
    expect(birthDate.max).toBe('2018-06-15')
  })

  it('沒填出生日期：送給後端的資料不帶 birthDate；成功後導到首頁', async () => {
    const page = await mountSignup()
    await fillRequired()
    await page.clickSubmit()
    expect(signup).toHaveBeenCalledWith({
      email: 'ming@example.com',
      username: '王小明',
      cellphone: '0912345678',
      password: 'password1',
    })
    await waitForRoute(page.router, 'home')
    expect(useNotifyQueue().value).toEqual([
      expect.objectContaining({ color: 'success', text: '註冊成功，歡迎加入會員' }),
    ])
  })

  it('有填出生日期：一起送出', async () => {
    const page = await mountSignup()
    await fillRequired()
    await fillField('出生日期', '2000-01-01')
    await page.clickSubmit()
    expect(signup).toHaveBeenCalledWith(expect.objectContaining({ birthDate: '2000-01-01' }))
  })

  it('出生日期年齡不在範圍內：顯示錯誤，不送出', async () => {
    const page = await mountSignup()
    await fillRequired()
    await fillField('出生日期', '2020-01-01')
    await page.clickSubmit()
    expect(getDescription(getInputByLabel('出生日期'))).toBe(
      '出生日期年齡必須介於 6 歲至 150 歲之間!',
    )
    expect(signup).not.toHaveBeenCalled()
  })

  it('後端回傳欄位錯誤：顯示在對應欄位下方，留在註冊頁', async () => {
    vi.mocked(signup).mockRejectedValue(
      new ApiError({
        kind: 'http',
        status: 400,
        message: '請求內容有誤',
        fieldErrors: { email: '此電子郵件已被註冊!' },
      }),
    )
    const page = await mountSignup()
    await fillRequired()
    await page.clickSubmit()
    expect(getDescription(getInputByLabel('電子郵件'))).toBe('此電子郵件已被註冊!')
    expect(page.formAlert()).toBeNull()
    expect(page.router.currentRoute.value.name).toBe('signup')
  })
})
