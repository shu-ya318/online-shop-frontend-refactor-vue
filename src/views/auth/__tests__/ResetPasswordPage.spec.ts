import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { fillField, getDescription, getInputByLabel } from '@/__tests__/formTestUtils'
import { useNotifyQueue } from '@/composables/notify'
import { resetPassword } from '@/services/auth'
import { ApiError } from '@/services/errors'
import ResetPasswordView from '@/views/auth/ResetPasswordView.vue'
import { mountAuthPage, unmountAuthPage, waitForRoute } from '@/views/auth/__tests__/authPageSetup'

vi.mock('@/services/auth')

const MISSING_TOKEN = '找不到重設驗證碼，請回到「忘記密碼」重新驗證身分。'

/** 從忘記密碼頁導過來：token 在 history.state */
const mountWithToken = () =>
  mountAuthPage(
    ResetPasswordView,
    (router) =>
      router.push({ name: 'reset-password', state: { resetPasswordToken: 'reset-token' } }),
    '重設密碼',
  )

async function fillPasswords(newPassword: string, confirmPassword: string) {
  await fillField('新密碼', newPassword)
  await fillField('確認新密碼', confirmPassword)
}

beforeEach(() => {
  useNotifyQueue().value = []
})
afterEach(() => {
  unmountAuthPage()
  vi.mocked(resetPassword).mockReset()
})

describe('ResetPasswordView', () => {
  it('直接開網址（沒有 token）：一進來就提示回忘記密碼頁，送出也不呼叫 API', async () => {
    const page = await mountAuthPage(ResetPasswordView, { name: 'reset-password' }, '重設密碼')
    expect(page.formAlert()?.textContent).toContain(MISSING_TOKEN)
    await fillPasswords('password1', 'password1')
    await page.clickSubmit()
    expect(resetPassword).not.toHaveBeenCalled()
    expect(page.formAlert()?.textContent).toContain(MISSING_TOKEN)
  })

  it('確認密碼不符：顯示錯誤；改新密碼讓兩者一致後，錯誤自動消失', async () => {
    const page = await mountWithToken()
    expect(page.formAlert()).toBeNull()
    await fillPasswords('password1', 'password2')
    const confirm = getInputByLabel('確認新密碼')
    expect(getDescription(confirm)).toBe('新密碼與確認密碼不符!')
    await fillField('新密碼', 'password2')
    expect(getDescription(confirm)).toBeNull()
  })

  it('重設成功：只送 token 與新密碼，導回登入頁並顯示成功訊息', async () => {
    vi.mocked(resetPassword).mockResolvedValue({ updatedAt: '2026-01-01T00:00:00Z' })
    const page = await mountWithToken()
    await fillPasswords('password1', 'password1')
    await page.clickSubmit()
    expect(resetPassword).toHaveBeenCalledWith({
      resetPasswordToken: 'reset-token',
      newPassword: 'password1',
    })
    await waitForRoute(page.router, 'login')
    expect(useNotifyQueue().value).toEqual([
      expect.objectContaining({ color: 'success', text: '密碼重設成功！' }),
    ])
  })

  it('token 過期：後端訊息顯示在送出按鈕上方，留在原頁', async () => {
    vi.mocked(resetPassword).mockRejectedValue(
      new ApiError({ kind: 'http', status: 401, message: '重設密碼 token 無效或已過期!' }),
    )
    const page = await mountWithToken()
    await fillPasswords('password1', 'password1')
    await page.clickSubmit()
    expect(page.formAlert()?.textContent).toContain('重設密碼 token 無效或已過期!')
    expect(page.router.currentRoute.value.name).toBe('reset-password')
  })
})
