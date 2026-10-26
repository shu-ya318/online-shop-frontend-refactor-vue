# data-flow(資料流總覽)

## 整體流程

```text
┌───────────────────────────────────────────────────────────┐
│ views/ 頁面、components/ 元件                              │
│   往下:props、v-model        往上:emit、函式 prop          │
└───────────────────────────────────────────────────────────┘
        │ 呼叫 action / 讀取 state                ▲ 響應式更新畫面
        ▼                                          │
┌───────────────────────────────────────────────────────────┐
│ stores/(Pinia,setup 寫法)                                 │
│   state、getter、action;錯誤放狀態,不彈窗                 │
└───────────────────────────────────────────────────────────┘
        │ 呼叫 services/<領域>/index.ts           ▲ 回傳資料或 reject ApiError
        ▼                                          │
┌───────────────────────────────────────────────────────────┐
│ services/<領域>/index.ts → http.ts 的 post<T>()           │
│   請求攔截器:帶 Bearer token(必要時先刷新)               │
│   回應攔截器:非業務 401 → 刷新並重送一次;失敗轉 ApiError  │
└───────────────────────────────────────────────────────────┘
        │ HTTP /api/v1                             ▲ JSON / 錯誤回應
        ▼                                          │
                       後端 Spring
```

```text
橫向的兩條線(不在上面的主幹裡):
- tokenManager:管 token 的讀寫、快過期判斷、刷新;auth store 訂閱它
- router 守衛:導覽前依 meta 決定放行 / 導頁,需要時呼叫 userStore.ensureUser()
```

## 各層職責與邊界

| 層                      | 負責                                             | 不能做                                   |
| ----------------------- | ------------------------------------------------ | ---------------------------------------- |
| `views/`、`components/` | 畫面、表單互動、決定訊息怎麼顯示(`notify`)、導頁 | 直接用 axios / fetch(一律經 `post<T>()`) |
| `stores/`               | 共用狀態、呼叫 service、把失敗存成狀態           | 彈窗或通知(UI 層自己決定)                |
| `services/<領域>/`      | 對應一支 API,型別在 `interface.ts`               | 導頁等副作用                             |
| `services/http.ts`      | token 附帶、401 刷新、錯誤轉 `ApiError`          | 碰 `window.location` 或 router           |
| `services/errors.ts`    | 把所有失敗統一成 `ApiError`                      | 導頁等副作用                             |
| `router/`               | 導覽前的登入與權限檢查、登入失效後的導頁         | 抓非導覽用的資料                         |

> 「stores 不彈窗」的例外:`stores/auth.ts` 的 `logout` 也不彈窗,而是回傳 `LogoutResult`,由 `UserProfileMenu` 決定顯示什麼。

## 流程 A:讀取資料(以 `ensureUser` 為例)

```text
router 守衛 / 元件
   │ user.ensureUser()
   ▼
沒有 token?────是──► 回傳 null,不打 API
   │否
已經有 userInfo?──是──► 直接回傳
   │否
有進行中的請求?──是──► 回傳同一個 Promise(共用)
   │否
fetchUser():requestId + 1 → getCurrentUser() → post<T>()
   │
   ├─ 成功且 requestId 仍是最新 → 寫入 userInfo
   ├─ 成功但已過期(期間登出、換帳號)→ 不寫入
   └─ 失敗 → 解除共用,reject 給呼叫端判斷
```

- 其他 store 的共通慣例(`store.md`):載入類 action 不 reject,失敗寫進 `xxxError`;同時呼叫共用同一個 Promise;用遞增編號擋過期回應。
- `ensureUser` 例外:失敗時 reject,因為路由守衛要分辨 401 與網路錯誤。
- 詳見 `store.md`。

## 流程 B:表單送出(以 `LoginView` 為例)

```text
使用者按送出
   │ AuthForm.onSubmit → props.submit()(= useForm 的 handleSubmit)
   ▼
useForm 以 zodRule 逐欄位驗證
   │ 通過
   ▼
onSubmit:auth.login(values)
   │
   ├─ 成功 → startSession(token) → router.replace(安全的 redirect 或首頁) → notify.success
   └─ 失敗 → splitApiError(error, form.values)
              ├─ fieldErrors → form.setErrors(...)(顯示在欄位下方)
              └─ formError  → submitError(顯示在送出按鈕上方)
   ▼
AuthForm:focusFirstError()(聚焦第一個 aria-invalid 欄位)
```

- 導頁放在 `try` 外面:導頁出問題不是「登入失敗」。
- 表單元件的拆分理由見 `component.md`。

## 流程 C:帶 token 與 401 刷新

```text
service 呼叫 post<T>()
   │
   ▼ 請求攔截器
是 /auth/* 端點?
   ├─ 是 → 不帶 token(例外:/auth/log-out 帶目前 token)
   └─ 否 → tokenManager.getValidAccessToken()
             ├─ 無 token → 不帶
             ├─ 快過期(< 30 秒或無法解析)→ refresh()(single-flight)
             └─ 還有效 → 帶 Bearer token
   ▼
後端回應
   ├─ 成功 → 回傳 response.data
   └─ 失敗 → 回應攔截器
        ├─ 401 + 這次有帶 token + 尚未重送 + 不是業務 401
        │     └─ refreshAfterUnauthorized → 有新 token 就重送一次
        └─ 其他 → toApiError → reject
```

- 業務 401(不刷新):`/auth/*` 與 `/user/update-password`(`NO_REFRESH_ON_401`)。
- 刷新用獨立的 `refreshClient`,避免刷新時又觸發刷新。
- 詳見 `request-flow.md`、`error-handling.md`。

## 流程 D:登入失效

```text
refresh 回 401 / 403(且 token 沒被換掉)
   │
   ▼
tokenManager.expireSession():清 token → 通知訂閱者 → 原本有 token 才觸發 onAuthExpired
   │
   ▼
router/authExpired.ts(在 main.ts 以 installAuthExpiredHandler 註冊)
   ├─ resetUserScopedStores(pinia):清掉 user、stationBookmark
   ├─ notify.warning('登入已失效,請重新登入')
   └─ 目前路由 requiresAuth / requiresAdmin → router.push(login, ?redirect=)
```

- auth store 以 `customRef` 訂閱 tokenManager,token 變化時 `isAuthenticated` 自動更新,畫面跟著變。
- 一般登出走 `endSession()`(`clearAuth` + `resetUserScopedStores`),不觸發 `onAuthExpired`。
- 需要新增與使用者綁定的 store 時,加 `{ userScoped: true }` 並提供 `$reset`(`store.md`)。

## 流程 E:版面的 props / emit(`MainLayout`)

```text
useUserStore.isAdmin ──► MainLayout.navItems(BASE 或 BASE + ADMIN)
                              │ props
                              ├──► AppHeader(navItems、sidebarOpen)── emit('toggle-sidebar')
                              └──► AppSidebar(items)+ v-model="isSidebarOpen"
```

- 狀態只有一份:`isSidebarOpen` 在 `MainLayout`。
- 詳見 `layout.md`。

## 錯誤處理

```text
後端 / 網路錯誤
   ▼
services/errors.ts:toApiError → ApiError(kind、status、message、fieldErrors)
   ▼
 ┌─ store:存進 xxxError 狀態,由畫面顯示
 ├─ 表單:splitApiError 分成欄位錯誤與整體錯誤
 ├─ 路由守衛:isApiError + status === 401 → 登入頁;其他依情況放行或取消
 └─ 沒人接住的錯誤:plugins/errorHandling.ts 全域捕捉
```

## 文件與程式碼不一致,待處理

1. **access token 存哪裡**:`CLAUDE.md` 寫「只存記憶體」,但 `tokenManager.ts` 預設用 `localStorage`(key `lookgo-auth`),只有 localStorage 不可用時才退回記憶體;`stores/auth.ts` 註解也寫持久化的 key 為 `lookgo-auth`。`layout.md` 的「記憶體裡有 access token」同樣不準確。本文以程式碼為準,`CLAUDE.md` 與 `layout.md` 要改哪一邊待你決定。
2. **WebSocket**:本文沒有畫 STOMP 的資料流,因為尚未讀過 `socket.ts` 與聊天相關 store;請看 `socket.md`,待確認後補一節。
3. **其他領域**:`views/` 下的 `tripPlan`、`stationChat`、`admin` 等頁面目前是否已接資料,未確認,本文不涵蓋。

## 需同步更新的文件

- `CLAUDE.md`、`docs/architecture/layout.md`:token 存放位置的描述(見上方第 1 點)
- `docs/README.md`:`architecture/` 以資料夾層級列出,是否逐檔加入 `data-flow.md`、`component.md` 待確認
