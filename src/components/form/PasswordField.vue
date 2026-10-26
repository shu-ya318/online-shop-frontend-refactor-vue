<script setup lang="ts">
import { ref } from 'vue'
import { mdiEye, mdiEyeOff } from '@mdi/js'

// 其他屬性（id、aria-*、placeholder、error…）沒有宣告成 props，會自動透傳到根元素 v-text-field
const model = defineModel<string>({ required: true })
const isVisible = ref(false)
</script>

<template>
  <v-text-field v-model="model" :type="isVisible ? 'text' : 'password'">
    <template #append-inner>
      <!-- 圖示表示「目前的狀態」：顯示中是睜眼，隱藏中是閉眼（和 React 版相同） -->
      <v-btn
        :icon="isVisible ? mdiEye : mdiEyeOff"
        :aria-pressed="isVisible"
        aria-label="顯示密碼"
        variant="text"
        size="small"
        density="comfortable"
        class="password-field__toggle"
        @click="isVisible = !isVisible"
      />
    </template>
  </v-text-field>
</template>
