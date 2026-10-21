import { createApp } from 'vue'
import { createPinia, disposePinia, setActivePinia, type Pinia } from 'pinia'

import { userScopedStoresPlugin } from '@/stores/plugins/userScoped'
import { MembershipTier, UserRole, UserStatus } from '@/services/user/types'
import type { CurrentUser } from '@/services/user/interface'

/**
 * 測試用的 pinia：裝上 userScoped plugin。
 * Pinia 的 plugin 要等 pinia 裝到某個 app 上才會生效（createPinia().use() 只是先排隊），
 * 所以這裡掛到一個空的 app；測試結束用 disposePinia() 釋放（store 的 onScopeDispose 會取消訂閱 tokenManager）。
 */
export const createTestPinia = (): Pinia => {
  const pinia = createPinia()
  pinia.use(userScopedStoresPlugin)
  createApp({}).use(pinia)
  setActivePinia(pinia)
  return pinia
}
export const releaseTestPinia = (pinia: Pinia): void => {
  disposePinia(pinia)
}

/** 手動控制 resolve / reject 時機的 Promise，用來模擬「晚到的回應」 */
export const createDeferred = <T>() => {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })

  return { promise, resolve, reject }
}

/** 測試用 access token：store 只當字串存取，不驗簽，tag 用來區分不同帳號 */
export const makeAccessToken = (tag = 'user'): string => {
  const encode = (value: object) => btoa(JSON.stringify(value))
  return `${encode({ alg: 'none', typ: 'JWT' })}.${encode({ exp: 4_102_444_800, tag })}.sig`
}

export const makeUser = (overrides: Partial<CurrentUser> = {}): CurrentUser => ({
  id: 1,
  email: 'ming@example.com',
  username: '王小明',
  membershipTier: MembershipTier.BASIC,
  role: UserRole.USER,
  cellphone: '0912345678',
  avatar: null,
  status: UserStatus.ACTIVE,
  createdAt: '2026-01-01T00:00:00',
  updatedAt: '2026-01-01T00:00:00',
  lastLoginAt: '2026-01-01T00:00:00',
  ...overrides,
})
