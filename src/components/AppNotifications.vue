<script setup lang="ts">
import { useNotifyQueue } from '@/composables/notify'
// React 版：<SnackbarProvider anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>（App.tsx:14）
// notistack 預設同時最多 3 則、5 秒自動關閉；這裡用 v-snackbar-queue 設成一樣。
// Vuetify 4 的 v-snackbar-queue 重寫過，可以同時顯示多則（v3 一次只顯示一則）。
const messages = useNotifyQueue()
</script>

<template>
  <v-snackbar-queue v-model="messages" location="bottom right" :total-visible="3" closable />
</template>
