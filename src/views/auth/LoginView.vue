<script setup lang="ts">
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import AuthForm from '@/components/auth/AuthForm.vue'
import FormField from '@/components/form/FormField.vue'
import PasswordField from '@/components/form/PasswordField.vue'
import { notify } from '@/composables/notify'
import { provideForm, useForm } from '@/composables/useForm'
import { zodRule } from '@/composables/zodRule'
import { getSafeRedirect } from '@/router/redirect'
import { loginSchema, type LoginValues } from '@/schemas/auth'
import { useAuthStore } from '@/stores/auth'
import { splitApiError } from '@/utils/formErrors'

const auth = useAuthStore()
const route = useRoute()
const router = useRouter()

/** 不屬於任何欄位的錯誤（帳密錯誤、網路斷線），顯示在送出按鈕上方 */
const submitError = ref<string | null>(null)

const form = useForm<LoginValues>({
  initialValues: { email: '', password: '' },
  rules: {
    email: [zodRule(loginSchema.shape.email)],
    password: [zodRule(loginSchema.shape.password)],
  },
  async onSubmit(formValues) {
    submitError.value = null

    try {
      await auth.login(formValues)
    } catch (error) {
      const { fieldErrors, formError } = splitApiError(error, form.values)
      form.setErrors(fieldErrors)
      submitError.value = formError
      return
    }

    // 導頁放在 try 外面：導頁出問題不是「登入失敗」
    await router.replace(getSafeRedirect(route.query.redirect) ?? { name: 'home' })
    notify.success('登入成功，歡迎回來')
  },
})
provideForm(form)

const { values, isSubmitting, handleSubmit } = form
</script>

<template>
  <AuthForm
    title="歡迎您回來"
    subtitle="請輸入電子郵件和密碼登入"
    submit-text="登入"
    :submit="handleSubmit"
    :submitting="isSubmitting"
    :error="submitError"
  >
    <FormField v-slot="{ inputAttrs, invalid }" name="email" label="電子郵件" required>
      <v-text-field
        v-model="values.email"
        v-bind="inputAttrs"
        :error="invalid"
        hide-details
        type="email"
        placeholder="請輸入電子郵件"
        autocomplete="username"
      />
    </FormField>
    <FormField v-slot="{ inputAttrs, invalid }" name="password" label="密碼" required>
      <PasswordField
        v-model="values.password"
        v-bind="inputAttrs"
        :error="invalid"
        hide-details
        placeholder="請輸入密碼"
        autocomplete="current-password"
      />
    </FormField>
    <!-- React 版是 <Link component='button' onClick={navigate}>：看起來像連結、其實是按鈕，不能開新分頁 -->
    <RouterLink :to="{ name: 'forget-password' }" class="align-self-start">忘記密碼?</RouterLink>
    <template #footer>
      <!-- 帶著 ?redirect= 過去：註冊完一樣回到原本要去的頁面 -->
      <RouterLink :to="{ name: 'signup', query: route.query }">
        還沒有帳號?<strong class="text-secondary-darken-1">點此註冊</strong>
      </RouterLink>
    </template>
  </AuthForm>
</template>

<style scoped></style>
