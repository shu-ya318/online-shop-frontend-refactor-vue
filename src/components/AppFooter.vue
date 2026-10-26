<script setup lang="ts">
import type { RouteLocationRaw } from 'vue-router'

import logoUrl from '@/assets/logo_transparent.png'

interface FooterItem {
  label: string
  to: RouteLocationRaw
}

// 對應 React 版 Footer.tsx 的 footerItems（路由名稱以 router/routes.ts 為準）
const FOOTER_ITEMS: readonly FooterItem[] = [
  { label: '路網圖查詢', to: { name: 'metro-map' } },
  { label: '車站聊天室', to: { name: 'station-chat-room' } },
  { label: '客製化旅程', to: { name: 'trip-planner' } },
  { label: '車站書籤', to: { name: 'station-bookmark' } },
]
</script>

<template>
  <!--
    響應式間距用 Vuetify utility class（斷點來自 styles/settings.scss，和 useDisplay 同一組數字）：
    React 版 py: { xs: 4, md: 6 }、px: { xs: 2, sm: 4, md: 6 }（MUI 1 = 8px）
    → py-8 py-md-12 px-4 px-sm-8 px-md-12（Vuetify 1 = 4px）
    注意：scoped CSS 沒有放在 CSS layer 裡，優先權高於 Vuetify 的 utility class，
    所以同一個元素上，utility class 管的屬性（display、flex-direction、padding…）不要再寫一次。
  -->
  <footer class="app-footer bg-tertiary-darken-1 py-8 py-md-12 px-4 px-sm-8 px-md-12">
    <div
      class="app-footer__inner d-flex flex-column flex-sm-row justify-space-between align-center mx-auto ga-6 ga-sm-4"
    >
      <RouterLink :to="{ name: 'home' }" class="app-footer__logo">
        <img :src="logoUrl" alt="LookGo 首頁" width="160" height="32" />
      </RouterLink>
      <nav class="d-flex flex-column flex-sm-row align-center ga-4 ga-sm-8" aria-label="頁尾導覽">
        <RouterLink
          v-for="item in FOOTER_ITEMS"
          :key="item.label"
          :to="item.to"
          class="app-footer__link"
        >
          {{ item.label }}
        </RouterLink>
      </nav>
    </div>
  </footer>
</template>

<style scoped>
.app-footer__inner {
  width: 100%;
  max-width: 768px;
}

.app-footer__logo {
  display: block;
  line-height: 0;
}

.app-footer__logo img {
  object-fit: cover;
}

.app-footer__link {
  font-size: 1rem;
  font-weight: 500;
  color: rgb(var(--v-theme-on-surface), var(--v-medium-emphasis-opacity));
  text-decoration: none;
}

.app-footer__link:hover,
.app-footer__link:focus-visible {
  color: rgb(var(--v-theme-primary));
}
</style>
