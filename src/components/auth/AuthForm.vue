<script setup lang="ts">
import { nextTick, useId, useTemplateRef } from 'vue'

const props = defineProps<{
  title: string
  subtitle: string
  submitText: string
  /**
   * 按下送出時要執行的函式，傳 useForm 的 handleSubmit。
   * 用函式 prop 而不是 emit('submit')：emit 拿不到回傳值，這裡要「等送出整個做完」才能檢查有沒有錯誤欄位。
   * （React 對照：就是 callback prop）
   */
  submit: () => Promise<void>
  /** 送出中：按鈕顯示讀取中（useForm 的 isSubmitting） */
  submitting: boolean
  /** 不屬於任何欄位的錯誤（帳密錯誤、網路斷線） */
  error: string | null
  /** 欄位少的頁面（忘記密碼、重設密碼）用比較大的間距，和 React 版一樣把卡片撐滿（gap 6rem） */
  spacious?: boolean
}>()
const titleId = useId()
const formEl = useTemplateRef<HTMLFormElement>('formEl')

async function onSubmit() {
  await props.submit()
  await focusFirstError()
}

async function focusFirstError() {
  await nextTick() // 等錯誤訊息與 aria-invalid 畫到畫面上
  formEl.value?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus()
}
/**
 * 正常的注音輸入，Enter 會被輸入法吃掉（keydown 的 key 是 'Process'），瀏覽器本來就不會送出；
 * 但如果組字中的 Enter 以 key 'Enter' 傳到網頁（isComposing 為 true），瀏覽器原生的「Enter 送出表單」
 * 會把還沒選完的字送出去。取消這個 keydown 的預設動作，表單就不會送出；組好的字不受影響。
 */
function onKeydownEnter(event: KeyboardEvent) {
  if (event.isComposing || event.keyCode === 229) {
    event.preventDefault()
  }
}
</script>

<template>
  <form
    ref="formEl"
    class="auth-form"
    :class="{ 'auth-form--spacious': spacious }"
    :aria-labelledby="titleId"
    novalidate
    @submit.prevent="onSubmit"
    @keydown.enter="onKeydownEnter"
  >
    <div class="text-center">
      <h1 :id="titleId" class="text-headline-large text-neutral-darken-1">{{ title }}</h1>
      <p class="text-body-small text-neutral mt-2">{{ subtitle }}</p>
    </div>
    <div class="auth-form__body">
      <div class="auth-form__fields">
        <slot />
      </div>
      <div class="auth-form__actions">
        <v-alert v-if="error" type="error" variant="tonal" density="compact">{{ error }}</v-alert>
        <v-btn type="submit" block variant="flat" :loading="submitting" class="auth-form__submit">
          {{ submitText }}
        </v-btn>
      </div>
    </div>
    <div v-if="$slots.footer" class="auth-form__footer text-center">
      <slot name="footer" />
    </div>
  </form>
</template>

<style scoped>
/*
 * 區塊間距，全部對齊 Vuetify 的 4px 間距格線（1rem = 16px）：
 * 標題／表單／頁尾 40px → 欄位區與按鈕區 32px → 欄位之間 24px → 錯誤訊息與按鈕 16px，由外到內遞減。
 * spacious 的 6rem 來自 React 版：欄位少的頁面拉開間距，卡片高度才和登入、註冊頁一致。
 */
.auth-form {
  display: flex;
  flex-direction: column;
  gap: 2.5rem;
}

.auth-form--spacious {
  gap: 6rem;
}

.auth-form__body,
.auth-form__fields,
.auth-form__actions {
  display: flex;
  flex-direction: column;
}

.auth-form__body {
  gap: 2rem;
}

.auth-form__fields {
  gap: 1.5rem;
}

.auth-form__actions {
  gap: 1rem;
}

/*
 * React 版送出按鈕的 sx（每頁各寫一次）：高 2.75rem、圓角 6px、底色 neutral.light、hover 變 neutral.dark。
 * 平常與 hover 的底色寫在同一個地方。用 color="neutral-lighten-1" 也可以，但 hover 的顏色還是要寫 CSS，
 * 一件事會分在兩個地方。
 */
.auth-form__submit {
  height: 2.75rem;
  padding: 0.625rem 0.875rem;
  color: rgb(var(--v-theme-on-neutral));
  background-color: rgb(var(--v-theme-neutral-lighten-1));
  border-radius: 6px;
}

.auth-form__submit:hover {
  background-color: rgb(var(--v-theme-neutral-darken-1));
}

/*
 * slot 裡的連結（「忘記密碼?」「點此註冊」）是頁面寫的，這個元件的 scoped CSS 預設選不到，
 * 用 :slotted() 幫它們上樣式。React 版：Link variant='button' color='secondary' underline='hover'
 */
.auth-form :slotted(a) {
  font-size: 1rem;
  font-weight: 500;
  color: rgb(var(--v-theme-secondary));
  text-decoration: none;
}

.auth-form :slotted(a:hover) {
  text-decoration: underline;
}
</style>
