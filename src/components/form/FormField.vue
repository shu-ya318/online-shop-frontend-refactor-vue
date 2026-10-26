<script setup lang="ts">
import { computed, useId } from 'vue'

import { injectForm } from '@/composables/useForm'

const props = defineProps<{
  /** 要對應 useForm 的 initialValues 裡的 key */
  name: string
  label: string
  required?: boolean
  /** 沒有錯誤時顯示的說明文字 */
  hint?: string
}>()

interface InputAttrs {
  id: string
  name: string
  'aria-labelledby': string
  'aria-describedby': string | undefined
  'aria-invalid': true | undefined
  'aria-required': true | undefined
  onBlur: () => void
}
defineSlots<{
  default(props: { id: string; invalid: boolean; inputAttrs: InputAttrs }): unknown
}>()

const form = injectForm()
const id = useId()
const labelId = `${id}-label`
const messageId = `${id}-message`
const error = computed(() => form.errors[props.name])
const checking = computed(() => form.validating[props.name] === true)
const hasMessage = computed(() => checking.value || Boolean(error.value) || Boolean(props.hint))
const inputAttrs = computed<InputAttrs>(() => ({
  id,
  name: props.name,
  // Vuetify 的 v-text-field 會在 <input> 加 aria-labelledby，指向它自己的浮動 label；
  // 我們的 label 畫在輸入框上方（和 React 版一樣），所以明確指到這個元件的 <label>
  'aria-labelledby': labelId,
  'aria-describedby': hasMessage.value ? messageId : undefined,
  'aria-invalid': error.value ? true : undefined,
  'aria-required': props.required ? true : undefined,
  // v-bind 一個物件時，on 開頭的 key 會被當成事件：離開欄位時通知 useForm（touched + 驗證）
  onBlur: () => form.handleBlur(props.name),
}))
</script>

<template>
  <div class="form-field">
    <label :id="labelId" :for="id" class="form-field__label">
      {{ label }}
      <!-- 星號只是視覺提示（aria-hidden），「必填」由輸入框的 aria-required 告訴螢幕閱讀器 -->
      <span v-if="required" class="form-field__required" aria-hidden="true">*</span>
    </label>

    <slot :id="id" :invalid="Boolean(error)" :input-attrs="inputAttrs" />

    <p
      v-if="checking"
      :id="messageId"
      class="form-field__message text-body-small text-medium-emphasis"
    >
      檢查中…
    </p>

    <p
      v-else-if="error"
      :id="messageId"
      class="form-field__message text-body-small text-error"
      role="alert"
    >
      {{ error }}
    </p>

    <p
      v-else-if="hint"
      :id="messageId"
      class="form-field__message text-body-small text-medium-emphasis"
    >
      {{ hint }}
    </p>
  </div>
</template>

<style scoped>
.form-field {
  display: flex;
  flex-direction: column;
}

.form-field__label {
  margin-bottom: 0.25rem;
  font-size: 1rem;
  font-weight: 500;
  color: rgb(var(--v-theme-neutral-darken-1));
}

.form-field__required {
  font-weight: 500;
  color: rgb(var(--v-theme-error));
}

/*
 * MUI FormHelperText 的位置：上 3px、左右 14px。字級（text-body-small）與顏色交給 utility class：
 * 這裡沒有 layer 的 CSS 優先權比 Vuetify 的 utility class 高，在這裡寫 color 會把 text-error 蓋掉（錯誤訊息變灰色）
 */
.form-field__message {
  margin: 3px 14px 0;
}
</style>
