# layout(版面:MainLayout、Header、Sidebar)

- 開發思路:先決定「怎麼拆」,再刻畫面(用假資料),最後才接 store 與 router。
- 主版面由 `layouts/MainLayout.vue` 組合 `components/header/AppHeader.vue`、`components/AppSidebar.vue`、`components/AppFooter.vue` 與 `<RouterView />`。

## 開發順序

```text
步驟 1 拆分      決定哪些抽成元件、資料流管理(判斷依據見 component.md)
   ▼
步驟 2 刻畫面    用假 props 刻出 MainLayout 骨架、AppHeader、AppSidebar、AppFooter、樣式
   ▼
步驟 3 接資料    MainLayout 接 store → UserProfileMenu 接 auth / user → router 守衛
```

## 步驟 1:拆分元件、資料流

| 元件              | 位置                 | 為什麼拆                                           |
| ----------------- | -------------------- | -------------------------------------------------- |
| `MainLayout`      | `layouts/`           | 擁有唯一的版面狀態與導覽資料,往下傳給子元件        |
| `AppHeader`       | `components/header/` | 桌機橫排導覽,有漢堡鈕與自己的互動                  |
| `UserProfileMenu` | `components/header/` | 只用一次,為隔離 store / router / `notify` 依賴而拆 |
| `AppSidebar`      | `components/`        | 手機抽屜,有焦點管理                                |

- 理由細節見 `component.md` 的決策表。
- 資料流:
  - 狀態只有一份:`isSidebarOpen` 放在 `MainLayout`,Header 與 Sidebar 都不自己存。
  - 導覽項目只有一份:`navItems`,Header(桌機)與 Sidebar(手機)共用。
  - 資料用 props 往下,事件用 emit 往上。

## 步驟 2:刻畫面(假資料)

先不接 store:`navItems`、`sidebarOpen` 都用寫死的值,確認畫面與 props。

### 2-1 MainLayout 的版面骨架

#### 設定語法對應效果

| 語法                                                                                                    | 效果                                         |
| ------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| `<v-main>` 包住 `<RouterView />` 與 `<AppFooter />`                                                     | `v-main` 依 `v-app-bar` 高度自動留出上方空間 |
| `.main-layout-main { display:flex; flex-direction:column }` + `.main-layout-content { flex: 1 0 auto }` | 內容不夠高時,內容區撐滿,頁尾貼在畫面底部     |

#### 應避免的錯誤

- 錯誤1:把 `<RouterView />` 放在 `v-main` 之外
  - `v-app-bar` 是固定在上方的元素
- 後果
  - 頁面上方會被 Header 蓋住(React 版需要手寫 `marginTop`,見 `MainLayout.vue` 內註解)
- Vue 版做法
  - 內容一律放進 `<v-main>`,由 Vuetify 自動留空間

### 2-2 AppHeader.vue(components/header/)

#### 設定語法對應效果

| 語法                                                           | 效果                                                               |
| -------------------------------------------------------------- | ------------------------------------------------------------------ |
| `defineProps<{ navItems; sidebarOpen }>()`                     | 型別宣告 props,只接收、不修改                                      |
| `defineEmits<{ 'toggle-sidebar': [] }>()`                      | 型別宣告事件,無參數                                                |
| `<v-app-bar :height="HEADER_HEIGHT" flat border="b">`          | 固定在上方、高度 70(`constants/layout.ts`)、無陰影、下方有線       |
| `class="d-md-none"`(漢堡鈕)                                    | `md`(1024px)以上隱藏,以下顯示                                      |
| `class="d-none d-md-flex"`(導覽 `<nav>`)                       | `md` 以下隱藏,以上顯示;與漢堡鈕剛好互補                            |
| `aria-controls="app-sidebar"` + `:aria-expanded="sidebarOpen"` | 告訴輔助技術「這顆鈕控制 id 為 `app-sidebar` 的元素,目前展開與否」 |
| `v-for="item in navItems" :key="item.label"`                   | 依資料產生導覽按鈕,`label` 作為 key                                |
| `:to="item.to"`                                                | `v-btn` 變成路由連結,目前頁面會加上 `v-btn--active`                |
| `<RouterLink :to="{ name: 'home' }">`                          | Logo 連到首頁,用路由名稱而不是寫死網址                             |
| `<img alt="LookGo 首頁">`                                      | 連結裡只有圖片時,`alt` 就是連結名稱                                |

#### 應避免的錯誤

- 錯誤2:漢堡鈕的 `aria-controls` 與 Sidebar 的 `id` 不一致
  - 兩邊都要是 `app-sidebar`,分別寫在 `AppHeader.vue` 與 `AppSidebar.vue`
- 後果
  - 螢幕閱讀器無法得知這顆鈕控制哪個區塊
- Vue 版做法
  - 改其中一邊的 id 時,兩個檔案一起改

- 錯誤3:用 `::after` 畫導覽按鈕的底線
  - Vuetify 的 `.v-btn::after` 已拿來畫 focus 外框(見 `AppHeader.vue` 註解)
- 後果
  - 自己的 `::after` 會取代 focus 外框,鍵盤使用者看不到焦點位置
- Vue 版做法
  - 用 `box-shadow: inset 0 -2px 0 ...`,條件為 `.v-btn--active` 與 `:hover`

### 2-3 AppSidebar.vue(components/)

#### 設定語法對應效果

| 語法                                                | 效果                                                                  |
| --------------------------------------------------- | --------------------------------------------------------------------- |
| `defineProps<{ items: readonly NavItem[] }>()`      | 導覽項目由外部傳入,Sidebar 不自己判斷權限                             |
| `defineModel<boolean>({ required: true })`          | 與父層 `v-model` 雙向綁定,取代手寫 `modelValue` + `update:modelValue` |
| `<v-navigation-drawer temporary>`                   | 蓋在內容上、有半透明背景,點背景會關閉;渲染成 `<nav>`                  |
| `retain-focus` + `@keydown.esc="open = false"`      | 焦點留在側欄內;按 `Esc` 關閉                                          |
| `useTemplateRef('closeButton')`                     | 取得關閉鈕,開啟時把焦點移過去                                         |
| `watch(open, async ...)` + `nextTick()`             | 開啟時記住原焦點並聚焦關閉鈕;關閉時把焦點還給漢堡鈕                   |
| `<v-list-item :to="item.to" @click="open = false">` | 點項目導頁並順便關閉側欄                                              |

#### 應避免的錯誤

- 錯誤4:開關側欄後沒有管理焦點
  - 開啟後焦點還在漢堡鈕,關閉後焦點消失
- 後果
  - 鍵盤使用者要從頁面最上方重新 Tab(見 `AppSidebar.vue` 註解)
- Vue 版做法
  - 開啟前記下 `document.activeElement`,`nextTick` 後聚焦關閉鈕;關閉後還回去,並先檢查 `isConnected`

- 錯誤5:在 `watch` 裡不等 `nextTick` 就呼叫 `focus()`
  - 抽屜剛設為開啟時,DOM 尚未更新完成
- 後果
  - `closeButton.value` 可能還取不到元素,焦點移動失敗(推論,未實測)
- Vue 版做法
  - `await nextTick()` 之後再 `focus()`

### 2-4 樣式與斷點(SCSS)

目前版面的樣式是 Vuetify 元件加少量 `<style scoped>`,**不是** SCSS。
SCSS 只出現在 `styles/settings.scss`,用來覆寫 Vuetify 的變數(斷點、字級)。

#### 設定語法對應效果

| 語法                                                    | 效果                                                                      |
| ------------------------------------------------------- | ------------------------------------------------------------------------- |
| `@use 'vuetify/settings' with ($grid-breakpoints: ...)` | 覆寫 Vuetify 預設值:`sm` 768、`md` 1024、`lg` 1280、`xl` 1536、`xxl` 2560 |
| `d-md-none`、`d-none d-md-flex`                         | 斷點工具 class,斷點值來自上面的 `$grid-breakpoints`                       |
| `useDisplay().mdAndUp`                                  | JS 端的斷點判斷,來自 `plugins/vuetify.ts` 的 `BREAKPOINTS`                |
| `.app-header__start`、`.app-header__nav-btn`            | 目前的 class 命名接近 BEM(`區塊__元素`)                                   |
| `:deep(.v-btn__overlay)` + `!important`                 | 穿透 scoped 去關掉 Vuetify 按鈕的 hover 背景                              |
| `rgb(var(--v-theme-primary))`                           | 取用 Vuetify 主題色的 CSS 變數                                            |

#### 應避免的錯誤

- 錯誤6:只改一邊的斷點
  - 斷點要同時寫在 `styles/settings.scss`(CSS)與 `plugins/vuetify.ts` 的 `BREAKPOINTS`(JS)
- 後果
  - 漢堡鈕顯示的寬度與 `mdAndUp` 切換的寬度不同,中間寬度會出現兩種導覽並存或都沒有(推論);`plugins/__tests__/vuetify.spec.ts` 會檢查兩邊是否對齊
- Vue 版做法
  - 兩邊一起改,並跑該 spec

- 錯誤7:用 `:deep()` 與 `!important` 當常態寫法
  - 為了壓過 Vuetify 內部 class
- 後果
  - 樣式依賴 Vuetify 內部結構,升級 Vuetify 後可能失效
- Vue 版做法
  - 能用元件 props(`variant`、`color`、`:ripple="false"`)就不寫覆寫;非寫不可時限定在單一元件並加註解

#### 搬到公司專案時要改的地方

公司專案是「SCSS + 原生 CSS」,且命名規則、全域變數檔結構**待確認**。以下只列技術對應:

| 目前(Vuetify)                    | 原生寫法                                      | 需自己處理                                    |
| -------------------------------- | --------------------------------------------- | --------------------------------------------- |
| `v-app-bar`                      | `<header>` + `position: sticky/fixed`         | 高度、層級(`z-index`)、下方邊線               |
| `v-navigation-drawer temporary`  | `<aside>` / `<nav>` + 遮罩 + `transform` 位移 | 開合動畫、遮罩點擊關閉、`Esc` 關閉、焦點管理  |
| `v-main`                         | `<main>`                                      | 手動留出 Header 高度(`padding-top`)           |
| `d-md-none` / `d-none d-md-flex` | `@media (min-width: 1024px)`                  | 斷點值與 JS 端同步(可改用 CSS 變數或共用常數) |
| `useDisplay().mdAndUp`           | `window.matchMedia('(min-width: 1024px)')`    | 監聽變化與清除監聽                            |
| `v-list-item :to` 的 active 樣式 | `RouterLink` 的 `router-link-active` class    | 自己寫 active 樣式                            |
| `rgb(var(--v-theme-primary))`    | 自訂 CSS 變數 `var(--color-primary)`          | 定義主題變數                                  |

## 步驟 3:接資料

### 資料流總覽

```text
router (meta) ──► authGuard ──► useUserStore.userInfo ──► isAdmin
                                                            │
MainLayout:navItems = isAdmin ? BASE + ADMIN : BASE ◄───────┘
   ├─ props ─► AppHeader(navItems, sidebarOpen) ── emit('toggle-sidebar')
   ├─ v-model ─► AppSidebar(items)
   └─ <RouterView />
```

- 全站資料流見 `data-flow.md` 流程 E。

### 3-1 MainLayout.vue:接 store 與狀態(layouts/)

#### 設定語法對應效果

| 語法                                                         | 效果                                                            |
| ------------------------------------------------------------ | --------------------------------------------------------------- |
| `const { isAdmin } = storeToRefs(useUserStore())`            | 取出 store 的 `isAdmin` 並保留響應性(reactive,值變了畫面跟著變) |
| `computed(() => isAdmin.value ? [...BASE, ...ADMIN] : BASE)` | 管理員多兩個導覽項目;值由 `isAdmin` 自動推導                    |
| `const isSidebarOpen = ref(false)`                           | 手機側欄開關,預設關閉                                           |
| `useDisplay()` 的 `mdAndUp`                                  | Vuetify 提供的響應式布林值,視窗寬度 ≥ `md`(1024px)時為 `true`   |
| `watch(mdAndUp, ...)`                                        | 變成桌機寬度時把 `isSidebarOpen` 關掉                           |
| `:sidebar-open` + `@toggle-sidebar`                          | 單向資料流:資料用 props 往下,事件用 emit 往上                   |
| `<AppSidebar v-model="isSidebarOpen" />`                     | 雙向綁定,Sidebar 內部可直接把它改成 `false`                     |

#### 應避免的錯誤

- 錯誤8:直接解構 store(`const { isAdmin } = useUserStore()`)
  - 解構出來的是一次性的值,不是 `ref`
- 後果
  - 登入或登出後 `isAdmin` 不更新,管理員導覽項目不會出現或消失
- Vue 版做法
  - 一律用 `storeToRefs(store)` 取 state 與 getter;action 才可直接解構

- 錯誤9:縮放視窗後沒有重設 `isSidebarOpen`
  - 手機寬度開著側欄,拉寬到桌機寬度時,漢堡鈕被 CSS 隱藏,狀態卻還是 `true`
- 後果
  - 開關狀態與畫面不一致,縮回手機寬度時側欄會直接是開著的(實際畫面待確認)
- Vue 版做法
  - 用 `watch(mdAndUp, ...)` 在進入桌機寬度時設回 `false`

### 3-2 UserProfileMenu.vue(components/header/)

自己讀 auth / user store、route、router 並呼叫 `notify`,所以 `AppHeader` 才能只靠 props 與 emit。

#### 設定語法對應效果

| 語法                                                                     | 效果                                                         |
| ------------------------------------------------------------------------ | ------------------------------------------------------------ |
| `storeToRefs(auth)` 取 `isAuthenticated`                                 | 是否有 token(`accessToken !== null`),決定顯示登入或設定/登出 |
| `storeToRefs(useUserStore())` 取 `userInfo`                              | 使用者名稱與頭像的來源                                       |
| `userInfo.value?.username ?? ''`                                         | 還沒載入使用者資料時是空字串,不會報錯                        |
| `v-if="avatarUrl"` ... `v-else` 人像圖示                                 | 沒有頭像時顯示預設圖示;`#error` slot 處理圖片載入失敗        |
| `<template #activator="{ props: activatorProps }">` + `v-bind`           | 把「開啟選單」所需的屬性綁到自己的按鈕上                     |
| `loginLocation = { name: 'login', query: { redirect: route.fullPath } }` | 登入後回到目前這一頁                                         |
| `isLoggingOut`                                                           | 登出中旗標,防止連點,並讓「登出」項目 `disabled`              |
| `auth.logout()` → `router.push({ name: 'login' })` → `notify`            | 先登出、再導頁、再顯示結果;伺服器沒回應時改顯示警告          |

#### 應避免的錯誤

- 錯誤10:登出沒有防重複觸發
  - 使用者連點「登出」
- 後果
  - `auth.logout()` 會被呼叫多次,可能出現多則通知
- Vue 版做法
  - 用 `isLoggingOut` 旗標先擋住,並在 `finally` 還原

- 錯誤11:`redirect` 直接信任網址參數
  - `loginLocation` 帶的是 `route.fullPath`,但讀取端不能直接信任
- 後果
  - 可能被導到站外網址
- Vue 版做法
  - 讀取時一律經 `getSafeRedirect()`(`router/redirect.ts`),`authGuard` 已這樣做

### 3-3 身分驗證與 router(與版面相關的部分)

#### 設定語法對應效果

| 語法 / 檔案                                                    | 效果                                                              |
| -------------------------------------------------------------- | ----------------------------------------------------------------- |
| `meta: { requiresAuth: true }`(`routes.ts`)                    | 此路由需要登入                                                    |
| `meta: { requiresAdmin: true }`                                | 此路由需要管理員;`/admin` 父路由設定後,子路由自動繼承             |
| `meta: { guestOnly: true }`                                    | 只給未登入者(`/auth/*`),已登入會被導走                            |
| `isAuthenticated = computed(() => accessToken.value !== null)` | 只代表「目前有 access token」,不代表後端認可                      |
| `userInfo`、`isAdmin`(`stores/user.ts`)                        | 使用者資料與角色;`isAdmin` 是 `role === UserRole.ADMIN` 推導而來  |
| `ensureUser()`                                                 | 沒 token 回 `null`;已有資料直接回;正在抓就共用同一個 Promise      |
| `{ userScoped: true }`                                         | 登出、換帳號、登入失效時由 auth store 觸發 `$reset()` 清空        |
| `authGuard`(`router/guards.ts`)                                | 每次導覽前依 `meta` 檢查,結果見下表                               |
| 公開頁、有 token                                               | 背景呼叫 `ensureUser()`,讓 Header 顯示使用者名稱,不等它也不擋導覽 |

> access token 的存放位置:`tokenManager.ts` 預設存在 `localStorage`(key `lookgo-auth`),`localStorage` 不可用時才退回記憶體。`CLAUDE.md` 寫「只存記憶體」與程式碼不一致,改哪一邊待確認。

`authGuard` 規則摘要(完整表格見 `router/guards.ts` 註解):

| 情況                          | 結果                                           |
| ----------------------------- | ---------------------------------------------- |
| 需要登入、沒 token            | 導到 `login`,帶 `?redirect=原網址`             |
| 需要登入、有 token            | 等 `ensureUser()`:401 → 登入頁;網路錯誤 → 放行 |
| 需要管理員、不是管理員        | 導到 `not-authorized`(`/unauthorized`)         |
| 需要管理員、確認不了身分      | 第一次導覽去首頁,否則取消導覽,並顯示錯誤通知   |
| `guestOnly`、已登入且確認成功 | 導到安全的 `redirect` 或首頁                   |

#### 應避免的錯誤

- 錯誤12:把「有 token」當成「登入有效」
  - token 可能已過期或被後端撤銷
- 後果
  - 畫面顯示已登入,實際 API 回 401
- Vue 版做法
  - 需要登入的頁面一律走 `ensureUser()` 向後端確認;`isAuthenticated` 只用來決定要不要發請求

- 錯誤13:網路錯誤時把管理員導到 `/unauthorized`
  - 抓不到使用者資料不等於沒有權限(React 版的 `AdminGuard` 有此問題)
- 後果
  - 管理員在斷線時看到「權限不足」,以為被降權
- Vue 版做法
  - 走 `handleUnverifiedAdmin`:顯示錯誤,取消導覽或回首頁,不判定權限

- 錯誤14:以為隱藏導覽項目就等於擋住管理頁
  - `ADMIN_NAV_ITEMS` 只是不顯示入口,使用者仍可直接輸入網址
- 後果
  - 若路由沒設 `requiresAdmin`,非管理員能進入管理頁
- Vue 版做法
  - 入口顯示(`navItems`)與權限檢查(`meta` + `authGuard`)各自負責;新增管理員頁面時兩邊都要加

- 錯誤15:登出後沒有清掉與使用者綁定的 store
  - `userInfo` 留在記憶體
- 後果
  - 下一位登入者在請求回來前,Header 可能短暫顯示上一位的名稱與頭像
- Vue 版做法
  - `useUserStore` 設定 `{ userScoped: true }`,由 `resetUserScopedStores()` 統一重置;`$reset` 同時作廢進行中的請求

## 新增或調整版面時的檢查清單

1. 先走步驟 1:新元件是否該拆,依 `component.md` 的判斷流程。
2. 步驟 2:用假 props 刻畫面,確認 props / emit 形狀、斷點(CSS 與 JS 兩邊)、`aria` 與焦點。
3. 步驟 3:再接 store;新增管理員頁面時,`navItems` 與 `meta.requiresAdmin` 兩邊都要加。
4. 新元件需對應 spec,放在 `components/__tests__/`。

## 需同步更新的文件

- `CLAUDE.md`:token 存放位置的描述(見步驟 3-3 的註記)
- `docs/README.md`:索引需加入 `architecture/layout.md`(尚未確認是否已加)
- `docs/architecture/router-flow.md`、`store.md`:若改動 `meta` 或 `userScoped` 行為,需一併更新
- `docs/architecture/component.md`、`data-flow.md`:若改動拆分或錯誤編號,需對照更新
