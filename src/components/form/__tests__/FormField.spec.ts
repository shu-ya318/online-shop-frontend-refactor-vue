import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { VTextField } from 'vuetify/components'

import FormField from '@/components/form/FormField.vue'
import { provideForm, useForm, type AsyncRule } from '@/composables/useForm'
import vuetify from '@/plugins/vuetify'
import { fillField, getDescription, getInputByLabel } from '@/__tests__/formTestUtils'

interface Values {
  email: string
}

interface MountOptions {
  /** 放在 FormField 裡的輸入框：原生 <input> 或 Vuetify 的 v-text-field */
  input?: 'native' | 'vuetify'
  hint?: string
  asyncRules?: AsyncRule<Values, 'email'>[]
}

let wrapper: VueWrapper | null = null
afterEach(() => {
  wrapper?.unmount()
  wrapper = null
})

function mountField({ input = 'native', hint, asyncRules = [] }: MountOptions = {}) {
  const Harness = defineComponent({
    setup() {
      const form = useForm<Values>({
        initialValues: { email: '' },
        rules: { email: [(value) => (value.includes('@') ? null : 'Email 格式不正確')] },
        asyncRules: { email: asyncRules },
        onSubmit: vi.fn<(values: Values) => void>(),
      })
      provideForm(form)
      const setEmail = (value: string) => {
        form.values.email = value
      }
      return () =>
        h(
          FormField,
          { name: 'email', label: '電子郵件', required: true, hint },
          {
            default: ({ inputAttrs, invalid }: { inputAttrs: object; invalid: boolean }) =>
              input === 'vuetify'
                ? h(VTextField, {
                    ...inputAttrs,
                    modelValue: form.values.email,
                    'onUpdate:modelValue': setEmail,
                    error: invalid,
                    hideDetails: true,
                  })
                : h('input', {
                    ...inputAttrs,
                    value: form.values.email,
                    onInput: (event: Event) => {
                      if (event.target instanceof HTMLInputElement) setEmail(event.target.value)
                    },
                  }),
          },
        )
    },
  })
  wrapper = mount(Harness, {
    global: { plugins: [vuetify] },
    attachTo: document.body, // getInputByLabel 用 document.getElementById 找輸入框
  })
  return wrapper
}

describe('FormField', () => {
  it('label 與輸入框互相連結；必填用 aria-required，星號不唸出來', () => {
    mountField()
    const input = getInputByLabel('電子郵件') // 會檢查 for / id / aria-labelledby
    expect(input.name).toBe('email')
    expect(input.getAttribute('aria-required')).toBe('true')
    expect(document.querySelector('.form-field__required')?.getAttribute('aria-hidden')).toBe(
      'true',
    )
  })

  it('還沒離開過欄位：不顯示錯誤；沒有說明文字時不設 aria-describedby', () => {
    mountField()
    const input = getInputByLabel('電子郵件')
    expect(input.hasAttribute('aria-invalid')).toBe(false)
    expect(input.hasAttribute('aria-describedby')).toBe(false)
  })

  it('有 hint 時用 aria-describedby 指向說明；出現錯誤就換成錯誤訊息', async () => {
    mountField({ hint: '我們會寄驗證信到這個信箱' })
    const input = getInputByLabel('電子郵件')
    expect(getDescription(input)).toBe('我們會寄驗證信到這個信箱')
    await fillField('電子郵件', 'abc')
    expect(getDescription(input)).toBe('Email 格式不正確')
  })

  it('離開欄位後驗證：錯誤訊息 role="alert"、輸入框 aria-invalid；改對後錯誤消失', async () => {
    mountField()
    await fillField('電子郵件', 'abc')
    const input = getInputByLabel('電子郵件')
    expect(input.getAttribute('aria-invalid')).toBe('true')
    expect(document.querySelector('[role="alert"]')?.textContent?.trim()).toBe('Email 格式不正確')
    await fillField('電子郵件', 'ming@example.com')
    expect(input.hasAttribute('aria-invalid')).toBe(false)
    expect(getDescription(input)).toBeNull()
  })

  it('非同步驗證中：顯示「檢查中…」', async () => {
    let finish!: (message: string | null) => void
    mountField({ asyncRules: [() => new Promise((resolve) => (finish = resolve))] })
    await fillField('電子郵件', 'ming@example.com')
    const input = getInputByLabel('電子郵件')
    expect(getDescription(input)).toBe('檢查中…')
    finish('此信箱已被註冊')
    await flushPromises()
    expect(getDescription(input)).toBe('此信箱已被註冊')
  })

  it('沒有放在 provideForm 底下：直接丟錯，不會默默不顯示錯誤', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(() =>
      mount(FormField, {
        props: { name: 'email', label: '電子郵件' },
        global: { plugins: [vuetify] },
      }),
    ).toThrow('FormField 必須放在呼叫過 provideForm() 的元件裡面')
    vi.restoreAllMocks()
  })

  it('放在 Vuetify 的 v-text-field：id、aria-*、name 都落在真正的 <input> 上，blur 一樣會驗證', async () => {
    mountField({ input: 'vuetify' })
    // getInputByLabel 會檢查 aria-labelledby 指向我們的 label（Vuetify 預設指向它自己的浮動 label）
    const input = getInputByLabel('電子郵件')
    expect(input.closest('.v-text-field')).not.toBeNull()
    await fillField('電子郵件', 'abc')
    expect(input.getAttribute('aria-invalid')).toBe('true')
    // aria-describedby 是 FormField 的訊息，不是 Vuetify 的訊息區（hide-details 已關掉）
    expect(getDescription(input)).toBe('Email 格式不正確')
    expect(document.querySelector('.v-field--error')).not.toBeNull()
  })
})
