<script setup lang="ts">
import { mdiClose } from '@mdi/js'
import { useId } from 'vue'

const props = withDefaults(
  defineProps<{
    title: string
    /** 沒有用 default slot 時顯示的純文字內容 */
    content?: string
    /** 寬度上限；手機上會自動縮到螢幕寬度減 32px（與 React 版相同） */
    width?: string
    /** true：只能用按鈕關閉（不能按 Esc、點背景），也不顯示右上角的關閉鈕 */
    persistent?: boolean
    /** 內容區額外的 class */
    contentClass?: string
  }>(),
  {
    content: undefined,
    width: '40.5rem',
    persistent: false,
    contentClass: undefined,
  },
)
const open = defineModel<boolean>({ required: true })
const titleId = useId()
</script>
<template>
  <v-dialog
    v-model="open"
    :width="props.width"
    max-width="calc(100vw - 32px)"
    :persistent="props.persistent"
    :aria-labelledby="titleId"
  >
    <v-card class="base-dialog" border="primary-lighten-1 opacity-100">
      <div class="base-dialog__header">
        <h2 :id="titleId" class="base-dialog__title text-headline-small">{{ props.title }}</h2>
        <v-btn
          v-if="!props.persistent"
          icon
          variant="text"
          aria-label="關閉對話框"
          class="base-dialog__close"
          @click="open = false"
        >
          <v-icon :icon="mdiClose" />
        </v-btn>
      </div>
      <v-card-text :class="props.contentClass">
        <slot>
          <p v-if="props.content" class="text-body-large text-medium-emphasis">
            {{ props.content }}
          </p>
        </slot>
      </v-card-text>
      <v-card-actions v-if="$slots.actions" class="base-dialog__actions">
        <slot name="actions" />
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
