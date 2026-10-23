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
  <v-app-bar :height="HEADER_HEIGHT" color="surface" flat border="b" class="app-header">
    <div class="app-header__inner">
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
        <RouterLink :to="{ name: 'home' }" class="app-header__logo">
          <!-- 連結裡只有圖片時，alt 就是連結的名稱 -->
          <img :src="logoUrl" alt="LookGo 首頁" width="84" height="17" />
        </RouterLink>
        <!-- 導覽按鈕：md 以上才顯示（d-* class 的斷點來自 styles/settings.scss） -->
        <nav class="d-none d-md-flex align-center ml-6" aria-label="主選單">
          <v-btn
            v-for="item in navItems"
            :key="item.label"
            :to="item.to"
            :prepend-icon="item.icon"
            variant="text"
            color="primary"
            class="app-header__nav-btn"
          >
            {{ item.label }}
          </v-btn>
        </nav>
      </div>
      <UserProfileMenu />
    </div>
  </v-app-bar>
</template>
