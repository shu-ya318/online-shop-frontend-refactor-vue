import { createI18n } from 'vue-i18n'

import en from '@/locales/en.json'
import zhTW from '@/locales/zh-TW.json'

export default createI18n({
  legacy: false,
  locale: 'zh-TW',
  fallbackLocale: 'en',
  messages: {
    'zh-TW': zhTW,
    en,
  },
})
