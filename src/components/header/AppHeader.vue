<script setup lang="ts">
import { RouterLink } from 'vue-router'

import UserProfileMenu from '@/components/header/UserProfileMenu.vue'

import logoUrl from '@/assets/logo_transparent.png'
import { HEADER_HEIGHT } from '@/constants/layout'

import type { NavItem } from '@/layouts/navItems'

defineProps<{
  navItems: readonly NavItem[]
  sidebarOpen: boolean
}>()

const emit = defineEmits<{
  'toggle-sidebar': []
}>()
</script>

<template>
  <!-- App bar (container) -->
  <!-- v-bind 綁定HEADER_HEIGHT，屬性值才被解析為 JS 運算式 (而非字串),取出變數的值-->
  <v-app-bar :height="HEADER_HEIGHT" color="surface" flat border="b" class="app-header">
    <!-- Inner content -->
    <div class="app-header__inner">
      <!-- Start section -->
      <div class="app-header__start">
        <!-- 漢堡選單：md（1024px）以下才顯示 -->
        <v-app-bar-nav-icon
          class="d-md-none"
          color="primary-darken-1"
          aria-label="開啟主選單"
          aria-controls="app-sidebar"
          :aria-expanded="sidebarOpen"
          @click="emit('toggle-sidebar')"
        />
        <!-- logo -->
        <RouterLink :to="{ name: 'home' }" class="app-header__logo">
          <!-- 連結裡只有圖片時，alt 就是連結的名稱 -->
          <img :src="logoUrl" alt="LookGo 首頁" width="84" height="17" />
        </RouterLink>
        <!-- Nav section ：md 以上才顯示 -->
        <nav class="app-header__nav d-none d-md-flex align-center ml-6" aria-label="主選單">
          <v-btn
            v-for="item in navItems"
            :key="item.label"
            :to="item.to"
            :prepend-icon="item.icon"
            :ripple="false"
            class="app-header__nav-btn"
            variant="text"
            color="primary"
          >
            {{ item.label }}
          </v-btn>
        </nav>
      </div>
      <!-- End section：User profile menu -->
      <UserProfileMenu />
    </div>
  </v-app-bar>
</template>

<style scoped>
.app-header__inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  max-width: 1280px;
  height: 100%;
  margin-inline: auto;
  padding-inline: 16px;
}

.app-header__start {
  display: flex;
  align-items: center;
  height: 100%;
}

.app-header__logo {
  display: flex;
  align-items: center;
  flex-shrink: 0;
}

.app-header__logo img {
  display: block;
}

.app-header__nav {
  height: 100%;
}

/* 選中狀態改用底線，不用背景色 */
.app-header__nav-btn {
  position: relative;
  height: 100%;
  border-radius: 0;
}

/* 取消 hover / focus / active 的背景色（Vuetify 以 overlay 實作） */
.app-header__nav-btn :deep(.v-btn__overlay) {
  opacity: 0 !important;
}

/* 不用 ::after，Vuetify 的 .v-btn::after 已拿來畫 focus 外框；hover 與選中同樣顯示底線 */
.app-header__nav-btn.v-btn--active,
.app-header__nav-btn:hover {
  box-shadow: inset 0 -2px 0 rgb(var(--v-theme-primary));
}
</style>
