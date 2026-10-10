import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { useAuthStore } from './stores/authStore'

import App from './App.vue'
import router from './router'
import i18n from './plugins/i18n'
import vuetify from './plugins/vuetify'

const app = createApp(App)

app.use(createPinia())
useAuthStore() // 提前建立，讓 setOnAuthExpired 在任何請求前就註冊
app.use(router)
app.use(i18n)
app.use(vuetify)

app.mount('#app')
