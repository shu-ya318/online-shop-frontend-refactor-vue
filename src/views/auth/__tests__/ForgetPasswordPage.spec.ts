import { afterEach, describe, expect, it, vi } from 'vitest'

import { fillField, getDescription, getInputByLabel } from '@/__tests__/formTestUtils'
import { forgetPassword } from '@/services/auth'
import { ApiError } from '@/services/errors'
import ForgetPasswordView from '@/views/auth/ForgetPasswordView.vue'
import { mountAuthPage, unmountAuthPage, waitForRoute } from '@/views/auth/__tests__/authPageSetup'

vi.mock('@/services/auth')

const mountForgetPassword = () =>
  mountAuthPage(ForgetPasswordView, { name: 'forget-password' }, '驗證身分')

async function fillValidForm() {
  await fillField('電子郵件', 'ming@example.com')
  await fillField('手機號碼', '0912345678')
}

afterEach(() => {
  unmountAuthPage()
  vi.mocked(forgetPassword).mockReset()
})

describe('ForgetPasswordView', () => {
  it('沒填就送出：兩個欄位都顯示錯誤，不呼叫 API', async () => {
    const page = await mountForgetPassword()
    await page.clickSubmit()
    expect(getDescription(getInputByLabel('電子郵件'))).toBe('請輸入有效格式的電子郵件!')
    expect(getDescription(getInputByLabel('手機號碼'))).toBe('請輸入手機號碼!')
    expect(forgetPassword).not.toHaveBeenCalled()
  })

  it('驗證成功：導到重設密碼頁，token 放在 history.state 而不是網址', async () => {
    vi.mocked(forgetPassword).mockResolvedValue({ resetPasswordToken: 'reset-token' })
    const page = await mountForgetPassword()
    await fillValidForm()
    await page.clickSubmit()
    expect(forgetPassword).toHaveBeenCalledWith({
      email: 'ming@example.com',
      cellphone: '0912345678',
    })
    await waitForRoute(page.router, 'reset-password')
    expect(page.router.currentRoute.value.fullPath).toBe('/auth/reset-password')
    expect(page.router.options.history.state.resetPasswordToken).toBe('reset-token')
  })

  it('驗證失敗：後端訊息顯示在送出按鈕上方，留在原頁', async () => {
    vi.mocked(forgetPassword).mockRejectedValue(
      new ApiError({ kind: 'http', status: 400, message: '電子郵件或手機號碼驗證失敗!' }),
    )
    const page = await mountForgetPassword()
    await fillValidForm()
    await page.clickSubmit()
    expect(page.formAlert()?.textContent).toContain('電子郵件或手機號碼驗證失敗!')
    expect(page.router.currentRoute.value.name).toBe('forget-password')
  })
})
