import {
  mdiAccountMultipleOutline,
  mdiBookmarkOutline,
  mdiChatOutline,
  mdiMapOutline,
  mdiRoutes,
  mdiTrain,
} from '@mdi/js'

import type { RouteLocationRaw } from 'vue-router'

export interface NavItem {
  label: string
  to: RouteLocationRaw
  /** @mdi/js 的 SVG path */
  icon: string
}
/** MUI 圖示 → MDI：MapOutlined → mdiMapOutline、BookmarkBorder → mdiBookmarkOutline、
 *  RouteOutlined → mdiRoutes、ChatBubbleOutlineOutlined → mdiChatOutline */
export const BASE_NAV_ITEMS: readonly NavItem[] = [
  { label: '路網圖查詢', to: { name: 'metro-map' }, icon: mdiMapOutline },
  { label: '車站書籤', to: { name: 'station-bookmark' }, icon: mdiBookmarkOutline },
  { label: '旅程規劃', to: { name: 'trip-planner' }, icon: mdiRoutes },
  { label: '車站聊天室', to: { name: 'station-chat-room' }, icon: mdiChatOutline },
]
/** PeopleOutlined → mdiAccountMultipleOutline、TrainOutlined → mdiTrain */
export const ADMIN_NAV_ITEMS: readonly NavItem[] = [
  { label: '使用者管理', to: { name: 'admin-user-management' }, icon: mdiAccountMultipleOutline },
  { label: '車站管理', to: { name: 'admin-station-management' }, icon: mdiTrain },
]
