import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'
import router from './router'
import i18n from './plugins/i18n'
import vuetify from './plugins/vuetify'
import { installErrorHandling } from './plugins/errorHandling'
import { installAuthExpiredHandler } from './router/authExpired'
import { userScopedStoresPlugin } from './stores/plugins/userScoped'

const app = createApp(App)
const pinia = createPinia()
pinia.use(userScopedStoresPlugin)

// 順序：pinia 要在 router 之前，app.use(router) 會立刻開始第一次導覽，守衛裡要用到 store
app.use(pinia)
app.use(i18n)
// 這兩個也要在第一次導覽之前裝好
installErrorHandling(app, router)
// 第一週 http.ts 留下的接口：refresh 失敗（登入失效）時要做什麼
installAuthExpiredHandler(router, pinia)
app.use(router)
app.use(vuetify)

app.mount('#app')
