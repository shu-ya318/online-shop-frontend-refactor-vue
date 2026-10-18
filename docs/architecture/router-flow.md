# 路由執行流程(src/router)

- 一次導覽從網址變化到畫面顯示的完整路徑:權限由 `routes.ts` 的 `meta` 宣告,由 `guards.ts` 的 `authGuard` 實際檢查,最後 `titleHook` 設定分頁標題。
- 本篇只寫 router;登入失效如何觸發見 [request-flow.md](./request-flow.md),`ensureUser()` 所在的 store 見 [store.md](./store.md)。

## 總流程圖

```
網址變化 (點連結 · router.push · 直接開網址 · 上一頁)
  │
  ▼
router/routes.ts
  ←  比對路由表,取得 to.meta(requiresAuth / requiresAdmin / guestOnly / title)
  │  比對不到 → /:pathMatch(.*)* → NotFoundPage
  │  比對到 redirect(/auth、/、/admin)→ 直接換成子路由,再走一次比對
  ▼
router/guards.ts   authGuard (beforeEach)
  ←  登入與權限檢查
  │
  │  auth.isAuthenticated?(只看有沒有 token,不問後端)
  ├─ 否 ─► 需要登入或管理員? ─ 是 ─► 登入頁 login?redirect=to.fullPath
  │                          └ 否 ─► 放行
  │  是(有 token,但不代表登入有效,要問後端)
  │
  ├─ guestOnly (/auth/*)
  │    └─ await user.ensureUser()
  │         ├─ 拿到使用者 ─► 導到 redirect(站內路徑)或 home
  │         └─ 失敗 / null ─► 放行,留在登入頁重新登入
  │
  ├─ requiresAuth / requiresAdmin
  │    └─ await user.ensureUser()
  │         ├─ 拋錯 401 ───────────► 登入頁 login?redirect=
  │         ├─ 拋錯 其他 + 需管理員 ─► handleUnverifiedAdmin()
  │         │                          ├─ 第一次導覽 → home + 錯誤提示
  │         │                          └─ 其他情況 → 取消導覽 + 錯誤提示
  │         ├─ 拋錯 其他 + 一般登入頁 ─► 放行(頁面自己的 API 會顯示錯誤)
  │         ├─ 回傳 null(等待期間 token 被清掉)─► 登入頁
  │         ├─ 需管理員但 role 不是 ADMIN ─► /unauthorized
  │         └─ 其餘 ─► 放行
  │
  └─ 公開頁
       └─ user.ensureUser() 背景載入,不等、不擋導覽 ─► 放行
  │
  ▼
元件載入(lazy import)→ 畫面顯示
  │
  ▼
router/guards.ts   titleHook (afterEach)
  ←  導覽成功才改 document.title:「<meta.title> - lookGo」


[旁支] 頁面停留期間,API 回報登入失效
  │
  ▼
router/authExpired.ts   installAuthExpiredHandler()
  ←  重設 user-scoped stores → 提示「登入已失效」
  └─► 目前路由有 requiresAuth / requiresAdmin 才 router.push(login?redirect=)
      (公開頁不導走)
```

## 檔案分工

依流程出現順序排列。

| 檔案                    | 職責                                                                     |
| ----------------------- | ------------------------------------------------------------------------ |
| `router/routes.ts`      | 路由表、版型分組,並用 `declare module` 擴充 `RouteMeta` 型別             |
| `router/index.ts`       | `createAppRouter()` 建立 router、掛上 `authGuard` / `titleHook`,匯出單例 |
| `router/guards.ts`      | `authGuard`(登入 / 權限檢查)與 `titleHook`(分頁標題)                     |
| `router/redirect.ts`    | `getSafeRedirect()`:嚴格驗證 `?redirect=`,供 `authGuard` 使用            |
| `router/authExpired.ts` | 登入失效處理:重設 store、提示、必要時導到登入頁                          |
| `stores/user.ts`        | `ensureUser()`:守衛用來確認身分,並共用進行中的請求                       |
| `main.ts`               | 決定初始化順序:pinia → 登入失效處理 → router                             |

## 路由表結構

| 路徑                    | 版型         | meta                             | 說明                                                               |
| ----------------------- | ------------ | -------------------------------- | ------------------------------------------------------------------ |
| `/auth/*`               | `AuthLayout` | `guestOnly`                      | 登入、註冊、忘記 / 重設密碼;`/auth` 導到 login                     |
| `/home`、`/metro-map`   | `MainLayout` | 無                               | 公開頁;`/` 導到 home                                               |
| `/user-setting` 等 4 頁 | `MainLayout` | `requiresAuth`                   | 個人設定、旅程規劃、車站書籤、聊天室                               |
| `/admin/*`              | `MainLayout` | `requiresAuth` + `requiresAdmin` | 無 component,子頁直接顯示在 `<RouterView>`;`/admin` 導到使用者管理 |
| `/unauthorized`         | 無           | 無                               | 權限不足                                                           |
| 其餘網址                | 無           | 無                               | 查無頁面                                                           |

## 階段 1:【初始化】順序

**問題**

- **守衛拿不到 store**:`app.use(router)` 會立刻開始第一次導覽,若 pinia 還沒安裝,守衛內 `useAuthStore()` 會失敗。
- **登入失效沒人接**:第一次導覽就可能觸發 API 與 401,處理函式若晚於 router 註冊就漏接。

**目標**

- **第一次導覽就能用 store 與登入失效處理**。
- **測試不碰瀏覽器網址列**。

**做法**

- **固定順序**:`main.ts` 先 `app.use(pinia)`、`installErrorHandling`、`installAuthExpiredHandler`,最後才 `app.use(router)`。
- **可注入 history**:`createAppRouter(history)` 預設 `createWebHistory`,測試傳 `createMemoryHistory()`。
- **換頁捲動**:`scrollBehavior` 預設回到頂端,按上一頁則回到原本位置。

## 階段 2:【導覽前】登入與權限檢查

**問題**

- **有 token ≠ 登入有效**:token 可能已被後端撤銷,只看 token 會放行,畫面載入後 API 才 401。
- **網路錯誤被當成沒權限**:管理員遇到斷線,若導到 `/unauthorized`,會被誤認為權限被拿掉。
- **網路錯誤放行管理頁**:放行則畫面會先顯示管理頁骨架。
- **重複抓使用者**:登入後同時有多處呼叫,同一個使用者被抓多次。
- **等待期間狀態改變**:守衛在 `await` 時,別的請求可能已判定登入失效並清掉 token。

**目標**

- **身分以後端為準**:需要登入的頁面都先確認身分。
- **區分「沒權限」與「確認不了」**:兩者結果不同。
- **公開頁不被拖慢**。

**做法**

- **沒 token 的快速路徑**:`auth.isAuthenticated` 為 false,需登入就導登入頁(帶 `redirect=to.fullPath`),否則放行。
- **共用請求**:一律呼叫 `user.ensureUser()`;已有資料直接回傳,正在抓則回傳同一個 Promise。
- **401 才算失效**:`isSessionExpired()` 只認 `ApiError.status === 401`,導登入頁。
- **一般頁面容錯**:抓不到使用者資料(非 401)仍放行,由頁面自己的 API 顯示錯誤。
- **管理員頁不放行也不誤判**:`handleUnverifiedAdmin()` 顯示錯誤通知;第一次導覽(`from === START_LOCATION`)導回首頁避免整頁空白,否則 `return false` 取消導覽、停在原頁。
- **等待後再檢查**:`ensureUser()` 回傳 `null` 視為登入已失效,導登入頁。
- **角色檢查**:`requiresAdmin` 且 `role !== UserRole.ADMIN` → `{ name: 'not-authorized' }`。
- **訪客頁**:已登入且確認身分成功就導走;確認失敗留在原頁,讓使用者重新登入。導向目標由 `redirect.ts` 的 `getSafeRedirect()` 驗證,只接受站內路徑(擋 `//`、`\`、控制字元、跨 origin、`/auth` 底下),不合格改去 home。
- **公開頁不等待**:背景呼叫 `ensureUser().catch(() => {})`,讓 Header 能顯示使用者資料;401 由 `onAuthExpired` 處理。

## 階段 3:【導覽後】分頁標題

**問題**

- **所有頁面同一個標題**:React 版分頁一律顯示 index.html 的標題。
- **導覽失敗也改標題**:被取消或被重新導向時,標題與實際畫面不符。

**目標**

- **標題對應目前頁面**。

**做法**

- **`titleHook`(afterEach)**:有 `failure` 就不改;有 `meta.title` 顯示 `<title> - lookGo`,沒有則只顯示 `lookGo`。

## 階段 4:【登入失效】頁面停留期間

**問題**

- **API 層導頁**:API 層若直接改網址,會整頁重載、無法測試。
- **公開頁被趕走**:在公開頁遇到登入失效,不該被強制導到登入頁。

**目標**

- **API 層不碰 router**。
- **只有受保護的頁面才導走**。

**做法**

- **注入處理函式**:`installAuthExpiredHandler(router, pinia)` 呼叫 `setOnAuthExpired`,並回傳解除註冊的函式。
- **三個動作**:`resetUserScopedStores(pinia)` → `notify.warning('登入已失效,請重新登入')` → 目前路由有 `requiresAuth` 或 `requiresAdmin` 才 `router.push({ name: 'login', query: { redirect: current.fullPath } })`。

## 待確認

- **登入頁如何使用 `redirect`**:本篇只確認守衛端(帶出與已登入時導回)。登入成功後 `LoginPage.vue` 是否也讀取 `redirect` 導回,尚未讀過,待確認。
