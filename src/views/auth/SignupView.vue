<script setup lang="ts">
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { format, subYears } from 'date-fns'

import AuthForm from '@/components/auth/AuthForm.vue'
import FormField from '@/components/form/FormField.vue'
import PasswordField from '@/components/form/PasswordField.vue'
import { notify } from '@/composables/notify'
import { provideForm, useForm } from '@/composables/useForm'
import { zodRule } from '@/composables/zodRule'
import { getSafeRedirect } from '@/router/redirect'
import { signupSchema, type SignupValues } from '@/schemas/auth'
import { useAuthStore } from '@/stores/auth'
import { splitApiError } from '@/utils/formErrors'

const auth = useAuthStore()
const route = useRoute()
const router = useRouter()

/** 不屬於任何欄位的錯誤（例如 Email 已被註冊、網路斷線），顯示在送出按鈕上方 */
const submitError = ref<string | null>(null)

const { shape } = signupSchema
const form = useForm<SignupValues>({
  initialValues: { email: '', username: '', cellphone: '', birthDate: '', password: '' },
  rules: {
    email: [zodRule(shape.email)],
    username: [zodRule(shape.username)],
    cellphone: [zodRule(shape.cellphone)],
    birthDate: [zodRule(shape.birthDate)],
    password: [zodRule(shape.password)],
  },
  async onSubmit({ birthDate, ...rest }) {
    submitError.value = null
    try {
      await auth.signup(birthDate ? { ...rest, birthDate } : rest)
    } catch (error) {
      const { fieldErrors, formError } = splitApiError(error, form.values)
      form.setErrors(fieldErrors)
      submitError.value = formError

      return
    }
    await router.replace(getSafeRedirect(route.query.redirect) ?? { name: 'home' })
    notify.success('註冊成功，歡迎加入會員')
  },
})
provideForm(form)
const { values, isSubmitting, handleSubmit } = form
// 日期選擇器可選的範圍：和 isValidBirthDateRange 一樣是 6～150 歲
const today = new Date()
const birthDateMin = format(subYears(today, 150), 'yyyy-MM-dd')
const birthDateMax = format(subYears(today, 6), 'yyyy-MM-dd')
</script>

<template>
  <AuthForm
    title="歡迎您的加入"
    subtitle="請填寫完整資訊以完成註冊"
    submit-text="註冊"
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
        autocomplete="email"
      />
    </FormField>
    <FormField v-slot="{ inputAttrs, invalid }" name="username" label="使用者名稱" required>
      <v-text-field
        v-model="values.username"
        v-bind="inputAttrs"
        :error="invalid"
        hide-details
        placeholder="請輸入使用者名稱"
        autocomplete="nickname"
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
    <!-- React 版用 MUI X DatePicker；這裡用瀏覽器原生的日期欄位，值一樣是 yyyy-MM-dd -->
    <FormField v-slot="{ inputAttrs, invalid }" name="birthDate" label="出生日期">
      <v-text-field
        v-model="values.birthDate"
        v-bind="inputAttrs"
        :error="invalid"
        hide-details
        type="date"
        :min="birthDateMin"
        :max="birthDateMax"
        autocomplete="bday"
      />
    </FormField>
    <FormField v-slot="{ inputAttrs, invalid }" name="password" label="密碼" required>
      <PasswordField
        v-model="values.password"
        v-bind="inputAttrs"
        :error="invalid"
        hide-details
        placeholder="請輸入密碼"
        autocomplete="new-password"
      />
    </FormField>
    <template #footer>
      <RouterLink :to="{ name: 'login', query: route.query }">
        已經有帳號?<strong class="text-secondary-darken-1">點此登入</strong>
      </RouterLink>
    </template>
  </AuthForm>
</template>

<style scoped></style>
