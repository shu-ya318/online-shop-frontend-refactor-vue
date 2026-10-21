<script setup lang="ts">
import { mdiAccountOutline, mdiLogin, mdiLogout } from '@mdi/js'
import { storeToRefs } from 'pinia'
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { notify } from '@/composables/notify'
import { DEFAULT_AVATAR_URL } from '@/constants/user'
import { useAuthStore } from '@/stores/auth'
import { useUserStore } from '@/stores/user'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

const { isAuthenticated } = storeToRefs(auth)
const { userInfo } = storeToRefs(useUserStore())

const username = computed(() => userInfo.value?.username ?? '')
const avatarUrl = computed(() => userInfo.value?.avatar || DEFAULT_AVATAR_URL)
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
        <v-avatar size="32" class="user-menu__avatar">
          <!-- 頭像只是裝飾，按鈕本身已有名稱，所以 alt 留空 -->
          <v-img :src="avatarUrl" alt="" cover>
            <template #error>
              <v-icon :icon="mdiAccountOutline" size="small" />
            </template>
          </v-img>
        </v-avatar>
        <span v-if="username" class="user-menu__name text-title-small">{{ username }}</span>
      </v-btn>
    </template>
    <v-list
      role="menu"
      density="compact"
      class="user-menu__list"
      :aria-label="menuLabel"
      min-width="160"
    >
      <template v-if="isAuthenticated">
        <v-list-item
          role="menuitem"
          :to="{ name: 'user-setting' }"
          :prepend-icon="mdiAccountOutline"
          title="設定"
        />
        <v-list-item
          role="menuitem"
          :prepend-icon="mdiLogout"
          title="登出"
          :disabled="isLoggingOut"
          data-testid="logout-item"
          @click="handleLogout"
        />
      </template>
      <v-list-item
        v-else
        role="menuitem"
        :to="loginLocation"
        :prepend-icon="mdiLogin"
        title="登入"
      />
    </v-list>
  </v-menu>
</template>
