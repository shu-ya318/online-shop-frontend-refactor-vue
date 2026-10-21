import { shallowRef } from 'vue'

export type NotifyColor = 'success' | 'error' | 'warning' | 'info'
export interface NotifyMessage {
  text: string
  color: NotifyColor
  /** 毫秒；-1 表示不自動關閉 */
  timeout?: number
}
/** notistack 的預設 autoHideDuration 也是 5 秒 */
export const DEFAULT_NOTIFY_TIMEOUT = 5000
/** v-snackbar-queue 的 v-model：顯示後元件會把它從陣列移除 */
const queue = shallowRef<NotifyMessage[]>([])
const push = (color: NotifyColor, text: string, timeout = DEFAULT_NOTIFY_TIMEOUT) => {
  // 換一個新陣列，shallowRef 才會通知畫面更新
  queue.value = [...queue.value, { text, color, timeout }]
}
export const notify = {
  success: (text: string) => push('success', text),
  error: (text: string) => push('error', text),
  warning: (text: string) => push('warning', text),
  info: (text: string) => push('info', text),
}
/** 給 AppNotifications.vue 用 */
export const useNotifyQueue = () => queue
