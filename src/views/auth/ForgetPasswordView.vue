<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'

import AuthForm from '@/components/auth/AuthForm.vue'
import FormField from '@/components/form/FormField.vue'
import { provideForm, useForm } from '@/composables/useForm'
import { zodRule } from '@/composables/zodRule'
import { forgetPasswordSchema, type ForgetPasswordValues } from '@/schemas/auth'
import { forgetPassword } from '@/services/auth'
import type { ForgetPasswordResponse } from '@/services/auth/interface'
import { splitApiError } from '@/utils/formErrors'

// 忘記密碼不會改變登入狀態，所以直接呼叫 service，不經過 authStore（store 只放「很多頁面都要知道」的狀態）
const router = useRouter()
const submitError = ref<string | null>(null)
const form = useForm<ForgetPasswordValues>({
  initialValues: { email: '', cellphone: '' },
  rules: {
    email: [zodRule(forgetPasswordSchema.shape.email)],
    cellphone: [zodRule(forgetPasswordSchema.shape.cellphone)],
  },
  async onSubmit(formValues) {
    submitError.value = null
    let response: ForgetPasswordResponse
    try {
      response = await forgetPassword(formValues)
    } catch (error) {
      // 例如 400「電子郵件或手機號碼驗證失敗!」（後端 Swagger 寫 401，實際是 400）
      const { fieldErrors, formError } = splitApiError(error, form.values)
      form.setErrors(fieldErrors)
      submitError.value = formError
      return
    }
    // token 放在 history.state（同 React 版的 location.state），不放網址：不會留在瀏覽紀錄、伺服器 log
    await router.push({
      name: 'reset-password',
      state: { resetPasswordToken: response.resetPasswordToken },
    })
  },
})
provideForm(form)
const { values, isSubmitting, handleSubmit } = form
</script>

<template>
  <AuthForm
    title="忘記密碼"
    subtitle="請輸入註冊時的電子郵件和手機號碼驗證身分"
    submit-text="驗證身分"
    :submit="handleSubmit"
    :submitting="isSubmitting"
    :error="submitError"
    spacious
  >
    <FormField v-slot="{ inputAttrs, invalid }" name="email" label="電子郵件" required>
      <v-text-field
        v-model="values.email"
        v-bind="inputAttrs"
        :error="invalid"
        hide-details
        type="email"
        placeholder="請輸入電子郵件"
        autocomplete="email"
      />
    </FormField>
    <FormField v-slot="{ inputAttrs, invalid }" name="cellphone" label="手機號碼" required>
      <v-text-field
        v-model="values.cellphone"
        v-bind="inputAttrs"
        :error="invalid"
        hide-details
        type="tel"
        placeholder="請輸入手機號碼"
        autocomplete="tel-national"
      />
    </FormField>
    <template #footer>
      <RouterLink :to="{ name: 'login' }">返回登入</RouterLink>
    </template>
  </AuthForm>
</template>

<style scoped></style>
