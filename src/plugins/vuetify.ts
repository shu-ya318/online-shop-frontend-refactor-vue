import 'vuetify/styles'

import { createVuetify, type ThemeDefinition } from 'vuetify'
import { aliases, mdi } from 'vuetify/iconsets/mdi-svg'
import { zhHant } from 'vuetify/locale'

/**
 * MUI 每個顏色有 dark / main / light 三個值，Vuetify 的顏色是扁平的名稱，這裡統一對應成：
 *   main → xxx，dark → xxx-darken-1，light → xxx-lighten-1
 * 例如 MUI 的 'primary.dark' 在 Vuetify 寫 color="primary-darken-1"，
 * CSS 裡寫 rgb(var(--v-theme-primary-darken-1))。
 *
 * 沒有開 theme.variations：自動產生的 lighten/darken 是用演算法算的，和 React 版手選色碼不同，所以每個變體都明確寫出來。
 */
const lookgoLight: ThemeDefinition = {
  dark: false,
  colors: {
    background: '#FFFFFF',
    surface: '#FFFFFF',
    'on-background': '#000000',
    'on-surface': '#000000',
    // 品牌藍
    primary: '#1565C0',
    'primary-darken-1': '#0D47A1',
    'primary-lighten-1': '#42A5F5',
    'on-primary': '#FFFFFF',
    // 黑（文字、圖示、框線）
    neutral: '#303030',
    'neutral-darken-1': '#000000',
    'neutral-lighten-1': '#505050',
    'on-neutral': '#FFFFFF',
    // 灰
    secondary: '#9C9C9C',
    'secondary-darken-1': '#828282',
    'secondary-lighten-1': '#BDBDBD', // MUI grey[400]
    // 淺灰
    tertiary: '#E0E0E0', // MUI grey[300]
    'tertiary-darken-1': '#D9D9D9',
    'tertiary-lighten-1': '#F1F1F1',
    // 白
    quaternary: '#F5F5F5',
    'quaternary-darken-1': '#F2F2F2',
    'quaternary-lighten-1': '#FFFFFF',
    // 狀態色
    warning: '#FAAD14',
    error: '#FF3B30',
    info: '#0288D1',
    'info-darken-1': '#0277BD',
    'info-lighten-1': '#B3E5FC',
    // 注意：React 版的 success.main 是淺綠 #BDEAA3，深綠 #2AC769 在 success.dark
    success: '#BDEAA3',
    'success-darken-1': '#2AC769',
    'success-lighten-1': '#F6FFED',
    // theme.ts:89-116 MuiFilledInput 的底色（SearchInput 用）
    'input-filled': '#EFF2F5',
  },
  // MUI text.primary = rgba(0,0,0,0.87)、text.secondary = rgba(0,0,0,0.6)；
  // Vuetify 用 on-surface 搭配下面兩個透明度，預設值剛好相同，這裡明寫出來方便對照
  variables: {
    'high-emphasis-opacity': 0.87,
    'medium-emphasis-opacity': 0.6,
  },
}

export const BREAKPOINTS = {
  xs: 0,
  sm: 768,
  md: 1024,
  lg: 1280,
  xl: 1536,
  xxl: 2560,
} as const

export const vuetifyOptions = {
  theme: {
    // Vuetify 4 的預設主題從 light 改成 system（跟著作業系統深色模式）。
    // React 版只有淺色（palette.mode = 'light'），不明確指定的話，深色模式的使用者會看到半套深色畫面。
    defaultTheme: 'lookgoLight',
    themes: { lookgoLight },
  },
  display: {
    thresholds: BREAKPOINTS,
    // useDisplay().mobile 在 md（1024）以下為 true，與 Header 切換漢堡選單的斷點一致
    mobileBreakpoint: 'md' as const,
  },
  icons: {
    // @mdi/js：每個圖示是一段 SVG path，用到哪個 import 哪個，打包時只會帶入用到的圖示
    defaultSet: 'mdi',
    aliases,
    sets: { mdi },
  },
  locale: {
    locale: 'zhHant',
    fallback: 'zhHant',
    messages: { zhHant },
  },
}

export default createVuetify(vuetifyOptions)
