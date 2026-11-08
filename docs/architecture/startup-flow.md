# 啟動流程(index.html → main.ts → App.vue → 各元件)

- 從瀏覽器打開網址,到頁面元件出現在畫面上的完整路徑。
- 本文只寫總覽:每一層「負責什麼、交棒給誰」，細節見各段連結的文件。

## 總流程圖

```text
瀏覽器請求網址(如：/metro-map)
  │  正式環境:nginx 找不到對應檔案時，回傳 index.html(try_files)
  ▼
index.html
  ←  建立空的 <div id="app">,再以 <script type="module"> 載入 /src/main.ts
  ▼
src/main.ts
  ←  createApp(App) 建立 app、createPinia() 建立 pinia
  │  依序安裝:pinia → i18n → errorHandling → authExpired → router → vuetify
  │  app.use(router) 當下就開始第一次導覽(非同步,不等它完成)
  │
  ├──► [第一次導覽] router/routes.ts 比對 → guards.ts authGuard 檢查
  │       → lazy import 頁面元件 → titleHook 設定分頁標題
  │
  ▼
app.mount('#app')
  ←  把 App.vue 渲染進 index.html 的 #app
  ▼
src/App.vue
  ←  <v-app> 包住 <RouterView /> 與 <AppNotifications />
  │  第一次導覽完成前,<RouterView /> 無對應路由,不顯示內容
  ▼
layouts/(由 routes.ts 的父路由決定)
  ←  /auth/*        → AuthLayout:左側品牌區 + 右側 <RouterView />
  │  其餘需版面的頁 → MainLayout:AppHeader + AppSidebar + <RouterView /> + AppFooter
  │  /unauthorized、查無頁面 → 不經版面,直接顯示在 App.vue 的 <RouterView />
  ▼
views/<領域>/XxxView.vue
  ←  子路由對應的頁面元件,顯示在 layout 內的第二層 <RouterView />
  ▼
components/
  ←  頁面與版面使用的共用元件
```

## 檔案分工

依流程出現順序排列。

| 檔案                           | 職責                                                      |
| ------------------------------ | --------------------------------------------------------- |
| `index.html`                   | 提供掛載點 `#app`,載入 `main.ts`                          |
| `src/main.ts`                  | 建立 app 與 pinia、決定外掛安裝順序、掛載                 |
| `src/router/`                  | 路由表、守衛、分頁標題、登入失效處理                      |
| `src/App.vue`                  | 根元件:`<v-app>`、第一層 `<RouterView />`、全域通知顯示區 |
| `src/layouts/AuthLayout.vue`   | 登入、註冊等訪客頁的版面                                  |
| `src/layouts/MainLayout.vue`   | 主版面:Header、Sidebar、Footer 與第二層 `<RouterView />`  |
| `src/views/<領域>/XxxView.vue` | 各頁面                                                    |
| `src/components/`              | 共用元件                                                  |

## 階段 1:index.html

- **只負責兩件事**:提供空的 `<div id="app">`,以及用 `<script type="module" src="/src/main.ts">` 載入程式。
- **開發時**:Vite 直接提供 `index.html`,並即時轉譯 `main.ts`。
- **正式環境**:`vite build` 會把 script 換成打包後的檔案;nginx 以 `try_files $uri $uri/ /index.html` 讓任何前端路由都回到 `index.html`,再交給 Vue Router 判斷。
- 細節見 [index-html.md](../setup/index-html.md)、[nginx.md](../deploy/nginx.md)。

## 階段 2:main.ts

- **建立實例**:`createApp(App)` 以 `App.vue` 為根元件;`createPinia()` 後先 `pinia.use(userScopedStoresPlugin)`,store 才能使用 `userScoped` 選項。
- **安裝順序有意義**:`app.use(router)` 會立刻開始第一次導覽,守衛內會用到 store,所以 pinia 必須在 router 之前;`installErrorHandling`、`installAuthExpiredHandler` 也要在第一次導覽之前註冊,才接得到導覽期間的錯誤與 401。
- **最後掛載**:`app.mount('#app')`。`main.ts` 沒有 `await router.isReady()`,所以掛載不會等第一次導覽完成。
- 細節見 [main-ts.md](../setup/main-ts.md)。

## 階段 3:第一次導覽(router)

- **比對路由**:`routes.ts` 依網址找到路由,取得 `meta`(`requiresAuth`、`requiresAdmin`、`guestOnly`、`title`)。
- **守衛檢查**:`guards.ts` 的 `authGuard`(beforeEach)檢查登入與權限,可能放行、導到登入頁或導到 `/unauthorized`。
- **載入頁面**:頁面元件皆為 `() => import(...)`,通過守衛後才下載;下載失敗由 `errorHandling.ts` 的 `router.onError` 顯示提示。
- **分頁標題**:`titleHook`(afterEach)在導覽成功後設定 `document.title`。
- 細節見 [router-flow.md](./router-flow.md)。

## 階段 4:App.vue

- **根元件只放全站共用的東西**:`<v-app>`(Vuetify 主題與基本樣式,設定在 `plugins/vuetify.ts`)、`<RouterView />`、`<AppNotifications />`(`notify` 的顯示區)。
- **第一層 `<RouterView />`**:顯示比對到的最上層路由元件,也就是 layout,或不經版面的錯誤頁。

## 階段 5:layout

- **版面由路由決定**:`/auth` 的 `component` 是 `AuthLayout`,`/` 的 `component` 是 `MainLayout`,子路由共用父路由的版面。
- **MainLayout 會接資料**:讀 `stores/user.ts` 的 `isAdmin` 決定導覽項目(`navItems.ts`),並依螢幕寬度控制 Sidebar。
- **第二層 `<RouterView />`**:顯示子路由對應的頁面元件。
- 細節見 [layout.md](./layout.md)。

## 階段 6:views 與 components

- **views**:每個子路由對應一個 `views/<領域>/XxxView.vue`(錯誤頁在 `views/error/`)。
- **components**:頁面與版面共用的元件;怎麼拆見 [component.md](./component.md)。
- **資料從哪來**:頁面透過 store 或 service 取得資料,HTTP 流程見 [request-flow.md](./request-flow.md),store 見 [store.md](./store.md)。
