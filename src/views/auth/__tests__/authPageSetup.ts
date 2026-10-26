import { expect, vi } from 'vitest'
import type { Component } from 'vue'
import type { Pinia } from 'pinia'
import { createMemoryHistory, type RouteLocationRaw, type Router } from 'vue-router'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'

import vuetify from '@/plugins/vuetify'
import { createAppRouter } from '@/router'
import { tokenManager } from '@/services/http'
import { createTestPinia, releaseTestPinia } from '@/test/testUtils'

export interface MountedAuthPage {
  wrapper: VueWrapper
  router: Router
  /** 送出按鈕（用按鈕文字找） */
  submitButton(): HTMLButtonElement
  /** 點送出並等畫面更新 */
  clickSubmit(): Promise<void>
  /** 送出按鈕上方的整體錯誤（AuthForm 的 v-alert）；沒有就回傳 null */
  formAlert(): HTMLElement | null
}

let current: { wrapper: VueWrapper; pinia: Pinia } | null = null

/**
 * 掛載 auth 頁面：真的 router（memory history）+ 真的 pinia + vuetify。
 * 頁面直接掛載、不經過 AuthLayout，router 只用來導頁與讀 history.state。
 *
 * @param page 頁面元件
 * @param at 起始路由；需要帶 history.state 時傳函式自己導頁
 * @param submitText 送出按鈕的文字
 */
export async function mountAuthPage(
  page: Component,
  at: RouteLocationRaw | ((router: Router) => Promise<unknown>),
  submitText: string,
): Promise<MountedAuthPage> {
  const pinia = createTestPinia()
  const router = createAppRouter(createMemoryHistory())
  await (typeof at === 'function' ? at(router) : router.push(at))
  const wrapper = mount(page, {
    global: { plugins: [pinia, router, vuetify] },
    attachTo: document.body, // 焦點、teleport 都需要真的掛在 document 上
  })
  current = { wrapper, pinia }
  await flushPromises()

  const submitButton = () => {
    const button = [...document.querySelectorAll('button[type="submit"]')].find(
      (el) => el.textContent?.trim() === submitText,
    )
    if (!(button instanceof HTMLButtonElement)) throw new Error(`找不到送出按鈕「${submitText}」`)
    return button
  }

  return {
    wrapper,
    router,
    submitButton,
    async clickSubmit() {
      submitButton().click()
      await flushPromises()
    },
    formAlert: () => document.querySelector<HTMLElement>('.auth-form .v-alert'),
  }
}

/** 等導頁完成。目標頁面是動態 import，第一次載入（整包測試一起跑時）可能超過 waitFor 預設的 1 秒 */
export async function waitForRoute(router: Router, name: string) {
  await vi.waitFor(() => expect(router.currentRoute.value.name).toBe(name), { timeout: 5000 })
}

/** afterEach 呼叫：卸載頁面、釋放 pinia、清掉登入狀態 */
export function unmountAuthPage() {
  current?.wrapper.unmount()
  if (current) releaseTestPinia(current.pinia)
  current = null
  tokenManager.clearAuth()
}
