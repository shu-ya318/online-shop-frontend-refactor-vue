<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'

import AuthForm from '@/components/auth/AuthForm.vue'
import FormField from '@/components/form/FormField.vue'
import PasswordField from '@/components/form/PasswordField.vue'
import { notify } from '@/composables/notify'
import { provideForm, useForm } from '@/composables/useForm'
import { zodRule } from '@/composables/zodRule'
import {
  confirmPasswordMatches,
  resetPasswordSchema,
  type ResetPasswordValues,
} from '@/schemas/auth'
import { resetPassword } from '@/services/auth'
import { splitApiError } from '@/utils/formErrors'

const router = useRouter()

// router.options.history 就是建立 router 時傳入的 history：正式環境讀的是瀏覽器的 history.state
// （重新整理還在；開新分頁、直接打網址就沒有），測試時是 createMemoryHistory。
const historyState = router.options.history.state
const resetPasswordToken =
  typeof historyState.resetPasswordToken === 'string' ? historyState.resetPasswordToken : ''
const MISSING_TOKEN = '找不到重設驗證碼，請回到「忘記密碼」重新驗證身分。'
const submitError = ref<string | null>(resetPasswordToken ? null : MISSING_TOKEN)
const form = useForm<ResetPasswordValues>({
  initialValues: { newPassword: '', confirmPassword: '' },
  rules: {
    newPassword: [zodRule(resetPasswordSchema.shape.newPassword)],
    confirmPassword: [zodRule(resetPasswordSchema.shape.confirmPassword), confirmPasswordMatches],
  },
  // 新密碼改了，已經填過的確認密碼要重新比對
  deps: { confirmPassword: ['newPassword'] },
  async onSubmit({ newPassword }) {
    if (!resetPasswordToken) {
      submitError.value = MISSING_TOKEN
      return
    }
    submitError.value = null
    try {
      // 確認密碼只在前端比對，不送給後端
      await resetPassword({ resetPasswordToken, newPassword })
    } catch (error) {
      // token 過期是 401「重設密碼 token 無效或已過期!」。第一週 http.ts 把 /auth/* 的 401 當成業務錯誤。
      const { fieldErrors, formError } = splitApiError(error, form.values)
      form.setErrors(fieldErrors)
      submitError.value = formError
      return
    }
    notify.success('密碼重設成功！')
    // replace：按上一頁不會回到這個已經用過 token 的頁面
    await router.replace({ name: 'login' })
  },
})
provideForm(form)
const { values, isSubmitting, handleSubmit } = form
</script>

<template>
  <AuthForm
    title="重設密碼"
    subtitle="請輸入新密碼"
    submit-text="重設密碼"
    :submit="handleSubmit"
    :submitting="isSubmitting"
    :error="submitError"
    spacious
  >
    <FormField v-slot="{ inputAttrs, invalid }" name="newPassword" label="新密碼" required>
      <PasswordField
        v-model="values.newPassword"
        v-bind="inputAttrs"
        :error="invalid"
        hide-details
        placeholder="請輸入新密碼"
        autocomplete="new-password"
      />
    </FormField>
    <FormField v-slot="{ inputAttrs, invalid }" name="confirmPassword" label="確認新密碼" required>
      <PasswordField
        v-model="values.confirmPassword"
        v-bind="inputAttrs"
        :error="invalid"
        hide-details
        placeholder="請再次輸入新密碼"
        autocomplete="new-password"
      />
    </FormField>
    <template #footer>
      <RouterLink :to="{ name: 'forget-password' }">重新驗證身分</RouterLink>
    </template>
  </AuthForm>
</template>

<style scoped></style>
