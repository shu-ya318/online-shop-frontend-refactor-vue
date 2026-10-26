import AuthLayout from '@/layouts/AuthLayout.vue'
import MainLayout from '@/layouts/MainLayout.vue'

import type { RouteRecordRaw } from 'vue-router'

declare module 'vue-router' {
  interface RouteMeta {
    /** 分頁標題（afterEach 設定 document.title） */
    title?: string
    /** 需要登入（取代 React 版的 requireAuthLoader） */
    requiresAuth?: boolean
    /** 需要管理員（取代 React 版的 AdminGuard 元件） */
    requiresAdmin?: boolean
    /** 只給未登入的人看（登入、註冊…）；已登入就導走（React 版 /auth 的 loader） */
    guestOnly?: boolean
  }
}

/**
 * 全網站路由表。
 * - /auth/*：AuthLayout，`guestOnly`，已登入者會被重導向
 * - /：MainLayout，內含公開頁、需登入頁與 /admin（需管理員）
 * - /unauthorized、其餘未匹配網址：錯誤頁
 * 權限由 `meta` 宣告，實際檢查在 `router/guards.ts` 的 `authGuard`。
 */
export const routes: RouteRecordRaw[] = [
  {
    path: '/auth',
    component: AuthLayout,
    meta: { guestOnly: true },
    children: [
      { path: '', redirect: { name: 'login' } },
      {
        path: 'login',
        name: 'login',
        component: () => import('@/views/auth/LoginView.vue'),
        meta: { title: '登入' },
      },
      {
        path: 'signup',
        name: 'signup',
        component: () => import('@/views/auth/SignupView.vue'),
        meta: { title: '註冊' },
      },
      {
        path: 'forget-password',
        name: 'forget-password',
        component: () => import('@/views/auth/ForgetPasswordView.vue'),
        meta: { title: '忘記密碼' },
      },
      {
        path: 'reset-password',
        name: 'reset-password',
        component: () => import('@/views/auth/ResetPasswordView.vue'),
        meta: { title: '重設密碼' },
      },
    ],
  },
  {
    path: '/',
    component: MainLayout,
    children: [
      { path: '', redirect: { name: 'home' } },
      {
        path: 'home',
        name: 'home',
        component: () => import('@/views/HomeView.vue'),
        meta: { title: '首頁' },
      },
      {
        path: 'metro-map',
        name: 'metro-map',
        component: () => import('@/views/metroMap/MetroMapView.vue'),
        meta: { title: '捷運地圖' },
      },

      {
        path: 'user-setting',
        name: 'user-setting',
        component: () => import('@/views/user/SettingView.vue'),
        meta: { title: '個人設定', requiresAuth: true },
      },
      {
        path: 'trip-planner',
        name: 'trip-planner',
        component: () => import('@/views/tripPlan/TripPlanView.vue'),
        meta: { title: '旅程規劃', requiresAuth: true },
      },
      {
        path: 'station-bookmark',
        name: 'station-bookmark',
        component: () => import('@/views/stationBookmark/StationBookmarkView.vue'),
        meta: { title: '車站書籤', requiresAuth: true },
      },
      {
        path: 'station-chat-room',
        name: 'station-chat-room',
        component: () => import('@/views/stationChat/StationChatView.vue'),
        meta: { title: '車站聊天室', requiresAuth: true },
      },
      {
        path: 'admin',
        meta: { requiresAuth: true, requiresAdmin: true },
        children: [
          { path: '', redirect: { name: 'admin-user-management' } },
          {
            path: 'user-management',
            name: 'admin-user-management',
            component: () => import('@/views/admin/UserPermissionView.vue'),
            meta: { title: '使用者管理' },
          },
          {
            path: 'station-management',
            name: 'admin-station-management',
            component: () => import('@/views/admin/StationManagementView.vue'),
            meta: { title: '車站管理' },
          },
        ],
      },
    ],
  },
  {
    path: '/unauthorized',
    name: 'not-authorized',
    component: () => import('@/views/error/NotAuthorizedView.vue'),
    meta: { title: '權限不足' },
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'not-found',
    component: () => import('@/views/error/NotFoundView.vue'),
    meta: { title: '查無頁面' },
  },
]
