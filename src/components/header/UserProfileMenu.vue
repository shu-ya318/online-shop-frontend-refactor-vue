<script setup lang="ts">
import { mdiAccount, mdiAccountOutline, mdiLogin, mdiLogout } from '@mdi/js'
import { storeToRefs } from 'pinia'
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { notify } from '@/composables/notify'
import { useAuthStore } from '@/stores/auth'
import { useUserStore } from '@/stores/user'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

const { isAuthenticated } = storeToRefs(auth)
const { userInfo } = storeToRefs(useUserStore())

const username = computed(() => userInfo.value?.username ?? '')
// 沒有自訂頭像時顯示人像圖示
const avatarUrl = computed(() => userInfo.value?.avatar ?? '')
// 可讀名稱要包含畫面上看得到的文字（使用者名稱），語音輸入「點 王小明」才找得到
const menuLabel = computed(() => (username.value ? `${username.value} 的使用者選單` : '使用者選單'))
// 登入後回到目前這一頁（守衛會檢查 redirect 只能是站內路徑）
const loginLocation = computed(() => ({ name: 'login', query: { redirect: route.fullPath } }))

const isLoggingOut = ref(false)

const handleLogout = async () => {
  if (isLoggingOut.value) {
    return
  }

  isLoggingOut.value = true

  try {
    const result = await auth.logout()
    await router.push({ name: 'login' })

    if (result.serverLoggedOut) {
      notify.success('登出成功!')
    } else {
      notify.warning(`已在這個裝置登出，但伺服器沒有回應：${result.error.message}`)
    }
  } finally {
    isLoggingOut.value = false
  }
}
</script>

<template>
  <v-menu location="bottom end">
    <template #activator="{ props: activatorProps }">
      <v-btn
        v-bind="activatorProps"
        variant="text"
        color="primary"
        class="user-menu__button"
        :aria-label="menuLabel"
        data-testid="user-menu-button"
      >
        <v-avatar size="32" color="primary" variant="tonal" class="user-menu__avatar">
          <!-- 頭像只是裝飾，按鈕本身已有名稱，所以 alt 留空 -->
          <v-img v-if="avatarUrl" :src="avatarUrl" alt="" cover>
            <template #error>
              <v-icon :icon="mdiAccount" />
            </template>
          </v-img>
          <v-icon v-else :icon="mdiAccount" />
        </v-avatar>
        <span v-if="username" class="user-menu__name text-title-small">{{ username }}</span>
      </v-btn>
    </template>
    <v-list role="menu" density="compact" class="user-menu__list" :aria-label="menuLabel">
      <template v-if="isAuthenticated">
        <v-list-item role="menuitem" :to="{ name: 'user-setting' }" title="設定">
          <template #prepend>
            <v-icon :icon="mdiAccountOutline" color="primary" />
          </template>
        </v-list-item>
        <v-list-item
          role="menuitem"
          title="登出"
          :disabled="isLoggingOut"
          data-testid="logout-item"
          @click="handleLogout"
        >
          <template #prepend>
            <v-icon :icon="mdiLogout" color="primary" />
          </template>
        </v-list-item>
      </template>
      <v-list-item v-else role="menuitem" :to="loginLocation" title="登入">
        <template #prepend>
          <v-icon :icon="mdiLogin" color="primary" />
        </template>
      </v-list-item>
    </v-list>
  </v-menu>
</template>
