import { ref, computed } from 'vue'
import { defineStore } from 'pinia'

import { useAuthStore } from '@/stores/auth'

import { getCurrentUser } from '@/services/user'
import { UserRole } from '@/services/user/types'
import type { CurrentUser } from '@/services/user/interface'

/** 目前登入使用者的資料與角色 */
export const useUserStore = defineStore(
  'user',
  () => {
    const userInfo = ref<CurrentUser | null>(null)
    const isAdmin = computed(() => userInfo.value?.role === UserRole.ADMIN)

    /** 進行中的 get-current-user（同時呼叫的人共用） */
    let pending: Promise<CurrentUser | null> | null = null
    /** 每發一次請求 +1，$reset() 也 +1。回應回來時編號不是最新的，就不寫入 */
    let latestRequestId = 0

    /** 發出請求，並用編號擋掉過期的回應 */
    const fetchUser = (): Promise<CurrentUser | null> => {
      const requestId = ++latestRequestId

      const request = getCurrentUser().then(
        (user) => {
          if (requestId !== latestRequestId) {
            // 等待期間已經登出、換帳號，或有更新的請求：不寫入，改回傳目前的狀態
            return pending ?? userInfo.value
          }

          pending = null
          userInfo.value = user
          return user
        },
        (error: unknown) => {
          if (requestId !== latestRequestId) {
            return pending ?? userInfo.value
          }

          // 解除共用，下次呼叫會重新抓；錯誤交給呼叫端判斷（路由守衛要分辨 401 和網路錯誤）
          pending = null
          throw error
        },
      )

      pending = request
      return request
    }

    /**
     * 確保已經有使用者資料。
     * - 沒有 token：回傳 null，不打 API
     * - 已經有資料：直接回傳
     * - 正在抓：回傳同一個 Promise（解決登入後同一個使用者被抓 3 次）
     * 失敗時 reject ApiError。
     */
    const ensureUser = (): Promise<CurrentUser | null> => {
      if (!useAuthStore().isAuthenticated) {
        return Promise.resolve(null)
      }

      if (userInfo.value) {
        return Promise.resolve(userInfo.value)
      }

      return pending ?? fetchUser()
    }

    /** 強制重新抓（例如設定頁修改資料後），會取代進行中的請求 */
    const refreshUser = (): Promise<CurrentUser | null> => {
      if (!useAuthStore().isAuthenticated) {
        return Promise.resolve(null)
      }

      return fetchUser()
    }

    /** 後端的修改 API 只回傳異動的欄位（例如頭像），合併回目前的資料 */
    const patchUser = (patch: Partial<CurrentUser>) => {
      if (userInfo.value) {
        userInfo.value = { ...userInfo.value, ...patch }
      }
    }

    /** 清空使用者資料並作廢進行中的請求 */
    const $reset = () => {
      // 讓進行中的請求作廢：登出後才回來的上一個人的資料不會被寫回來
      latestRequestId++
      pending = null
      userInfo.value = null
    }

    return { userInfo, isAdmin, ensureUser, refreshUser, patchUser, $reset }
  },
  // 登出、換帳號、登入失效時由 auth store 呼叫 $reset()，避免下一位使用者看到上一位的資料
  { userScoped: true },
)
