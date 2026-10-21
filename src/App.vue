<script setup lang="ts">
import AppNotifications from '@/components/AppNotifications.vue'

// 對應 React 版 App.tsx 的 Provider 組合：
//   <ThemeProvider> + <CssBaseline>  → v-app（主題與基本樣式由 createVuetify 提供，見 plugins/vuetify.ts）
//   <SnackbarProvider>               → <AppNotifications />（notify 服務的顯示區）
//   <RouterProvider router={router}> → <RouterView />（router 在 main.ts 用 app.use 安裝）
</script>

<template>
  <v-app>
    <RouterView />
    <AppNotifications />
  </v-app>
</template>
