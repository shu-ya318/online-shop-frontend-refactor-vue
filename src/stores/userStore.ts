import { ref } from 'vue'
import { defineStore } from 'pinia'

import type { GetCurrentUserResponse } from '@/services/user/interface'

export const useUserStore = defineStore('user', () => {
  const userInfo = ref<GetCurrentUserResponse | null>(null)

  const setUserInfo = (info: GetCurrentUserResponse | null) => {
    userInfo.value = info
  }

  return { userInfo, setUserInfo }
})
