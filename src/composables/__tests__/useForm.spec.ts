import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick } from 'vue'

import {
  useForm,
  type AsyncRule,
  type ErrorMessage,
  type UseFormOptions,
} from '@/composables/useForm'

interface Values {
  username: string
  password: string
  confirmPassword: string
}

const required = (message: string) => (value: string) => (value ? null : message)
const lengthBetween = (min: number, max: number) => (value: string) =>
  value.length >= min && value.length <= max ? null : `長度必須為 ${min}-${max} 個字`

/** 假的「帳號是否已被使用」API：delay 毫秒後回應，abort 時 reject（和 axios 被取消一樣） */
function fakeCheck(taken = 'taken', delay = 100) {
  return vi.fn<AsyncRule<Values, 'username'>>(
    (value, _values, signal) =>
      new Promise<ErrorMessage>((resolve, reject) => {
        const timer = setTimeout(() => resolve(value === taken ? '帳號已被使用' : null), delay)
        signal.addEventListener('abort', () => {
          clearTimeout(timer)
          reject(new DOMException('aborted', 'AbortError'))
        })
      }),
  )
}

// useForm 裡面有 watch：放進 effectScope 建立，測完 stop，watcher 才不會留到下一個測試
let scope = effectScope()
function setup(overrides: Partial<UseFormOptions<Values>> = {}) {
  scope = effectScope()
  const form = scope.run(() =>
    useForm<Values>({
      initialValues: { username: '', password: '', confirmPassword: '' },
      rules: {
        username: [required('請輸入帳號')],
        password: [required('請輸入密碼'), lengthBetween(8, 20)],
        confirmPassword: [(v, all) => (v === all.password ? null : '兩次密碼不一致')],
      },
      deps: { confirmPassword: ['password'] },
      onSubmit: vi.fn<(values: Values) => void>(),
      ...overrides,
    }),
  )
  if (!form) throw new Error('useForm 沒有建立')
  return form
}
type Form = ReturnType<typeof setup>

function fillValid(form: Form) {
  form.values.username = 'ming'
  form.values.password = 'password1'
  form.values.confirmPassword = 'password1'
}

beforeEach(() => {
  vi.useFakeTimers()
})
afterEach(() => {
  scope.stop()
  vi.useRealTimers()
})

describe('useForm：狀態', () => {
  it('1. 初始狀態：沒有錯誤、沒有 touched、沒改過；values 是 initialValues 的副本', () => {
    const initialValues = { username: 'ming', password: '', confirmPassword: '' }
    const form = setup({ initialValues })
    expect(form.values).toEqual(initialValues)
    form.values.username = 'other'
    expect(initialValues.username).toBe('ming')
    form.values.username = 'ming'
    expect(form.errors).toEqual({})
    expect(form.touched).toEqual({})
    expect(form.isDirty.value).toBe(false)
    expect(form.isValid.value).toBe(true)
    expect(form.submitCount.value).toBe(0)
  })

  it('2. 改值：dirty 跟著變，改回原值就不算改過', () => {
    const form = setup()
    form.values.username = 'ming'
    expect(form.dirty.value.username).toBe(true)
    expect(form.isDirty.value).toBe(true)
    form.values.username = ''
    expect(form.isDirty.value).toBe(false)
  })
})

describe('useForm：同步驗證', () => {
  it('3. 沒離開過的欄位：輸入時不驗證、不顯示錯誤', async () => {
    const form = setup()
    form.values.password = 'abc'
    await nextTick()
    expect(form.errors).toEqual({})
  })

  it('4. blur：標成 touched 並驗證，顯示第一條沒過的規則', async () => {
    const form = setup()
    form.handleBlur('username')
    await nextTick()
    expect(form.touched.username).toBe(true)
    expect(form.errors.username).toBe('請輸入帳號')
    expect(form.isValid.value).toBe(false)
  })

  it('5. 規則依序執行：必填過了才輪到長度', async () => {
    const form = setup()
    form.values.password = 'abc'
    expect(await form.validateField('password')).toBe(false)
    expect(form.errors.password).toBe('長度必須為 8-20 個字')
  })

  it('6. 摸過的欄位：改值時重新驗證，改對了錯誤就消失（errors 不留 undefined 的 key）', async () => {
    const form = setup()
    form.handleBlur('username')
    form.values.username = 'ming'
    await nextTick()
    expect(form.errors).toEqual({})
  })

  it('7. deps：密碼改了，已經摸過的確認密碼要重新比對', async () => {
    const form = setup()
    form.values.password = 'password1'
    form.values.confirmPassword = 'password1'
    form.handleBlur('confirmPassword')
    await nextTick()
    expect(form.errors.confirmPassword).toBeUndefined()
    form.values.password = 'password2'
    await nextTick()
    expect(form.errors.confirmPassword).toBe('兩次密碼不一致')
  })

  it('8. deps：確認密碼還沒摸過時，改密碼不會提早顯示它的錯誤', async () => {
    const form = setup()
    form.values.password = 'password1'
    await nextTick()
    expect(form.errors.confirmPassword).toBeUndefined()
  })
})

describe('useForm：送出', () => {
  it('9. 驗證失敗：全部欄位標成 touched、顯示錯誤，不呼叫 onSubmit', async () => {
    const onSubmit = vi.fn<(values: Values) => void>()
    const form = setup({ onSubmit })
    await form.handleSubmit()
    expect(onSubmit).not.toHaveBeenCalled()
    expect(form.touched).toEqual({ username: true, password: true, confirmPassword: true })
    expect(form.errors).toEqual({ username: '請輸入帳號', password: '請輸入密碼' })
    expect(form.submitCount.value).toBe(1)
    expect(form.isSubmitting.value).toBe(false)
  })

  it('10. 驗證通過：onSubmit 收到值的快照，改快照不會動到表單', async () => {
    let received: Values | undefined
    const form = setup({
      onSubmit: (values) => {
        received = values
      },
    })
    fillValid(form)
    await form.handleSubmit()
    expect(received).toEqual({
      username: 'ming',
      password: 'password1',
      confirmPassword: 'password1',
    })
    if (!received) throw new Error('onSubmit 沒有被呼叫')
    received.username = 'changed'
    expect(form.values.username).toBe('ming')
  })

  it('11. 送出中：isSubmitting 為 true，再送一次直接忽略', async () => {
    let finish!: () => void
    const onSubmit = vi.fn<(values: Values) => Promise<void>>(
      () => new Promise<void>((resolve) => (finish = resolve)),
    )
    const form = setup({ onSubmit })
    fillValid(form)
    const first = form.handleSubmit()
    expect(form.isSubmitting.value).toBe(true)
    await form.handleSubmit()
    await vi.waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1))
    finish()
    await first
    expect(onSubmit).toHaveBeenCalledTimes(1)
    expect(form.submitCount.value).toBe(1)
    expect(form.isSubmitting.value).toBe(false)
  })

  it('12. onSubmit 丟出錯誤：錯誤往外傳，isSubmitting 一樣會結束', async () => {
    const form = setup({
      onSubmit: () => Promise.reject(new Error('boom')),
    })
    fillValid(form)
    await expect(form.handleSubmit()).rejects.toThrow('boom')
    expect(form.isSubmitting.value).toBe(false)
  })

  it('13. setErrors：放入後端回傳的欄位錯誤；之後改值就由前端驗證接手', async () => {
    const form = setup()
    fillValid(form)
    await form.handleSubmit()
    form.setErrors({ username: '帳號已存在' })
    expect(form.errors).toEqual({ username: '帳號已存在' })
    form.values.username = 'ming2'
    await nextTick()
    expect(form.errors).toEqual({})
  })

  it('14. reset：值、錯誤、touched、送出次數都回到初始狀態', async () => {
    const form = setup()
    form.values.username = 'ming'
    await form.handleSubmit()
    form.reset()
    expect(form.values).toEqual({ username: '', password: '', confirmPassword: '' })
    expect(form.errors).toEqual({})
    expect(form.touched).toEqual({})
    expect(form.submitCount.value).toBe(0)
  })
})

describe('useForm：非同步驗證', () => {
  it('15. 同步規則沒過就不打 API；同步過了才打，驗證中 validating 為 true', async () => {
    const check = fakeCheck()
    const form = setup({ asyncRules: { username: [check] } })
    expect(await form.validateField('username')).toBe(false)
    expect(check).not.toHaveBeenCalled()
    form.values.username = 'taken'
    const result = form.validateField('username')
    expect(form.validating.username).toBe(true)
    await vi.runAllTimersAsync()
    expect(await result).toBe(false)
    expect(form.errors.username).toBe('帳號已被使用')
    expect(form.validating.username).toBe(false)
  })

  it('16. 邊打邊驗：停手 asyncDebounceMs 後只打一次 API；API 失敗顯示暫時無法驗證', async () => {
    const check = fakeCheck()
    const form = setup({ asyncRules: { username: [check] }, asyncDebounceMs: 300 })
    form.handleBlur('username')
    for (const value of ['m', 'mi', 'min', 'ming']) {
      form.values.username = value
      await nextTick()
      await vi.advanceTimersByTimeAsync(100)
    }
    expect(check).not.toHaveBeenCalled()
    await vi.runAllTimersAsync()
    expect(check).toHaveBeenCalledTimes(1)
    expect(check.mock.calls[0]?.[0]).toBe('ming')
    expect(form.errors).toEqual({})

    check.mockRejectedValueOnce(new Error('network'))
    expect(await form.validateField('username')).toBe(false)
    expect(form.errors.username).toBe('暫時無法驗證，請稍後再試')
  })

  it('17. 改值後同一個 tick 立刻送出：onSubmit 仍然會被呼叫一次（回歸測試）', async () => {
    const onSubmit = vi.fn<(values: Values) => void>()
    const form = setup({ onSubmit, asyncRules: { username: [fakeCheck()] } })
    fillValid(form)
    // 和改值在同一個 tick：handleSubmit 先把欄位標成 touched，欄位 watcher 在送出之後才跑，
    // 領到更新的號碼牌，送出那一輪就過期了。舊版把「過期的一輪」直接回傳 false，送出就無聲無息地停了
    const submitting = form.handleSubmit()
    await vi.runAllTimersAsync()
    await submitting
    expect(onSubmit).toHaveBeenCalledTimes(1)
    expect(form.errors).toEqual({})
  })
})

it('18. 陣列欄位比內容：沒改是 false、push 後 true、刪回原樣又是 false（回歸測試）', () => {
  const initial = { tags: ['捷運'] }
  scope = effectScope()
  const form = scope.run(() =>
    useForm({ initialValues: initial, onSubmit: vi.fn<(values: { tags: string[] }) => void>() }),
  )
  if (!form) throw new Error('useForm 沒有建立')
  // 舊版用 Object.is 比：values 是另一個陣列，一開始就被判成改過
  expect(form.dirty.value.tags).toBe(false)
  form.values.tags.push('公車')
  expect(form.dirty.value.tags).toBe(true)
  expect(initial.tags).toEqual(['捷運']) // 呼叫端傳進來的陣列沒有被改到
  form.values.tags.pop()
  expect(form.dirty.value.tags).toBe(false)
  expect(form.isDirty.value).toBe(false)
})
