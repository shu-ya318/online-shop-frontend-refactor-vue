import { afterEach, describe, it, expect } from 'vitest'
import { createMemoryHistory } from 'vue-router'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'

import App from '@/App.vue'
import i18n from '@/plugins/i18n'
import vuetify from '@/plugins/vuetify'
import { createAppRouter } from '@/router'
import { createTestPinia, releaseTestPinia } from '@/test/testUtils'

describe('App', () => {
  let wrapper: VueWrapper | null = null
  const pinia = createTestPinia()

  afterEach(() => {
    wrapper?.unmount()
    releaseTestPinia(pinia)
  })

  it('掛上 router、pinia 後：未登入進 /auth 會顯示 AuthLayout 與登入頁', async () => {
    const router = createAppRouter(createMemoryHistory())
    await router.push('/auth')
    wrapper = mount(App, {
      global: { plugins: [pinia, router, vuetify, i18n] },
      attachTo: document.body,
    })
    await flushPromises()
    expect(router.currentRoute.value.name).toBe('login')
    expect(wrapper.text()).toContain('一個快速搜尋臺北捷運資訊並規劃旅程的整合平台')
    expect(wrapper.find('h1').text()).toBe('歡迎您回來')
  })
})
