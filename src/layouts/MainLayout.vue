<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useDisplay } from 'vuetify'

import AppFooter from '@/components/AppFooter.vue'
import AppSidebar from '@/components/AppSidebar.vue'
import AppHeader from '@/components/header/AppHeader.vue'

import { useUserStore } from '@/stores/user'
import { ADMIN_NAV_ITEMS, BASE_NAV_ITEMS } from './navItems'

const { isAdmin } = storeToRefs(useUserStore())

const navItems = computed(() =>
  isAdmin.value ? [...BASE_NAV_ITEMS, ...ADMIN_NAV_ITEMS] : BASE_NAV_ITEMS,
)

const isSidebarOpen = ref(false)

const { mdAndUp } = useDisplay()

watch(mdAndUp, (isDesktop) => {
  if (isDesktop) {
    isSidebarOpen.value = false
  }
})
</script>

<template>
  <AppHeader
    :nav-items="navItems"
    :sidebar-open="isSidebarOpen"
    @toggle-sidebar="isSidebarOpen = !isSidebarOpen"
  />
  <AppSidebar v-model="isSidebarOpen" :items="navItems" />
  <!-- v-main 會依 v-app-bar 的高度自動留出上方空間，不必像 React 版寫 marginTop -->
  <v-main class="main-layout-main">
    <div class="main-layout-content">
      <RouterView />
    </div>
    <AppFooter />
  </v-main>
</template>

<style scoped>
/* 頁尾貼在畫面底部：內容不夠高時，內容區撐滿剩下的高度 */
.main-layout-main {
  display: flex;
  flex-direction: column;
}

.main-layout-content {
  flex: 1 0 auto;
}
</style>
