<script setup lang="ts">
import BaseDialog from '@/components/BaseDialog.vue'

withDefaults(
  defineProps<{
    title: string
    loading?: boolean
    confirmText?: string
    cancelText?: string
    /** 確認鈕的顏色（主題色名稱） */
    confirmColor?: string
  }>(),
  {
    loading: false,
    confirmText: '刪除',
    cancelText: '取消',
    confirmColor: 'error',
  },
)
const open = defineModel<boolean>({ required: true })
const emit = defineEmits<{
  confirm: []
}>()
</script>
<template>
  <!-- 內容區 padding：React 版 extraStyles '0 1.5rem 3.625rem 1.5rem'，用 utility class 表達（pb-14 = 56px）。
       對話框內容會被移到 body 底下（teleport），這個元件的 scoped CSS 選不到 BaseDialog 裡的元素，所以用全域的 utility class -->
  <BaseDialog
    v-model="open"
    :title="title"
    width="55rem"
    persistent
    content-class="pt-0 px-6 pb-14"
  >
    <slot />
    <template #actions>
      <v-btn
        variant="outlined"
        color="neutral"
        class="confirm-dialog__button"
        @click="open = false"
      >
        {{ cancelText }}
      </v-btn>
      <v-btn
        variant="flat"
        :color="confirmColor"
        :loading="loading"
        :disabled="loading"
        class="confirm-dialog__button"
        @click="emit('confirm')"
      >
        {{ confirmText }}
      </v-btn>
    </template>
  </BaseDialog>
</template>
