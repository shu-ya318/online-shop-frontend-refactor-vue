# 狀態管理

## Pinia

### 核心特質

- **Setup Store 組合式架構**：採用 Vue 3 Composition API 語法 (`ref`, `computed`, `function`)，實現邏輯高度獨立性與擴充性。
- **自動細粒度響應訂閱**：依靠 Vue 響應式系統自動追蹤 Template 實際讀取的屬性並精準訂閱，無須手動撰寫 Selector。
- **安全解構與單向數據流**：解構 State/Getter 時透過 `storeToRefs()` 維持響應性；狀態變更統一由 Action 負責，禁止元件隨意修改。
- **模組獨立與集中重置**：各 Store 職責單一具備完整 TypeScript 型別，並可透過 Pinia Plugin（如 `userScoped`）達跨 Store 一鍵重置機制。

### 和 zustand 重要差異

| 比較維度         | Pinia (Vue 3)                                                                    | Zustand (React)                                                           |
| :--------------- | :------------------------------------------------------------------------------- | :------------------------------------------------------------------------ |
| **訂閱機制**     | **自動追蹤**：Template 讀取的屬性自動精準訂閱，無多餘開銷                        | **手動指定**：須顯式撰寫 Selector，否則預設訂閱全 Store 易引發無效重繪    |
| **定義範式**     | **Setup Store**：語法與 Composition API 完全一致 (`ref`, `computed`, `function`) | **Hook 工廠**：經由 `create()` 定義狀態與變更方法                         |
| **解構寫法**     | **語法安全**：State/Getter 須經 `storeToRefs()` 保留響應性                       | **直接解構**：可直接解構，但漏寫 Selector 會引發全量刷新                  |
| **狀態真相來源** | **單一來源**：結合 `tokenManager` / `customRef` 等管理，防止資料副本不同步       | **多重副本**：常搭配 `persist` 中間件存於 LocalStorage，易致狀態同步失效  |
| **UI 解耦原則**  | **邏輯純粹**：Store 僅維護狀態與暴露 Error State，彈窗與通知由 UI 層自主控制     | **強行耦合**：易於 Store 內部直接呼叫 UI 通知 (如 Snackbar)，破壞分層架構 |

## Store 總覽

檔案在 `src/stores/`，檔名為領域名，匯出 `useXxxStore`，一律 Setup 寫法。

| Store                     | 檔案                 | 職責                                   | `userScoped` |
| :------------------------ | :------------------- | :------------------------------------- | :----------- |
| `useAuthStore`            | `auth.ts`            | 登入狀態、登入 / 註冊 / 登出           | 否           |
| `useUserStore`            | `user.ts`            | 目前使用者資料與角色                   | 是           |
| `useMetroMapStore`        | `metroMap.ts`        | 路網圖、車站選項、起訖站路徑、設施篩選 | 否           |
| `useStationStore`         | `station.ts`         | 選取的車站、車站詳情、設施篩選         | 否           |
| `useStationBookmarkStore` | `stationBookmark.ts` | 書籤快取、新增 / 刪除 / 切換           | 是           |

輔助檔案：

- `stores/plugins/userScoped.ts`：`userScoped` Pinia Plugin 與 `resetUserScopedStores()`（見下方「跨 Store 重置」）。
- `stores/helpers.ts`：`asApiError(error)`，把任意錯誤轉成 `ApiError`（已是 `ApiError` 就原樣回傳，否則包成 `kind: 'unknown'`），讓 Store 的錯誤狀態型別一致。

### 共通慣例

- **錯誤放狀態、不彈窗**：載入類 action 不會 reject，失敗寫入 `xxxError`（`ApiError`），由畫面決定怎麼顯示。
- **併發共用請求**：同時呼叫共用同一個進行中的 Promise（single-flight），結束後（成功或失敗）解除，失敗可重試。
- **防過期回應**：用遞增編號（`latestRequestId` / `generation`）判斷回應是否仍為最新，過期就不寫入。
- **大物件用 `shallowRef`**：`lines`、`routeResult`、`stationDetail`、錯誤物件等不需要深層響應的資料。

## 跨 Store 重置（userScoped）

### 流程

```text
[ 正確流程 ]
Store 以 defineStore(id, setup, { userScoped: true }) 宣告，並在 setup 提供 $reset
   │
   ▼
userScopedStoresPlugin 建立 Store 時登記到該 pinia 實例的 registry
   │
   ▼
startSession() / endSession() 呼叫 resetUserScopedStores()
   │
   ▼
registry 內每個 Store 執行 $reset()：清資料、作廢進行中的請求
   │
   ▼
Store 被 $dispose() 時自動從 registry 移除

[ 錯誤流程 ]
登出只清 token，各 Store 自行決定要不要清
   │
   ▼
忘了某個 Store，或進行中的請求在登出後才回來
   │
   ▼
❌【問題】下一位使用者看到上一位的使用者資料 / 書籤
```

### 重點

- `userScoped` 的 Store **必須在 setup 回傳 `$reset`**，否則重置時無作用。
- 登入（`startSession`）時也會先重置，避免換帳號殘留舊資料。
- Plugin 要在 `app.use(pinia)` 之後才生效；測試裡要先把 pinia 裝到一個 app 上。
- 新增與使用者綁定的 Store（例如聊天室、行程）時，記得加 `userScoped: true`。

## 1. authStore (Token 與驗證狀態)

### 對外介面

| 成員                                 | 說明                                                          |
| :----------------------------------- | :------------------------------------------------------------ |
| `accessToken`                        | 唯讀 computed，來源是 `tokenManager.getAccessToken()`         |
| `isAuthenticated`                    | 是否持有 token                                                |
| `login(request)` / `signup(request)` | 呼叫 API 成功後 `startSession(token)`；失敗 reject `ApiError` |
| `logout()`                           | **永遠 resolve**，回傳 `LogoutResult`（後端是否登出成功）     |
| `endSession()`                       | 清 token 並重置 `userScoped` Store（登入失效流程也會用）      |

### 流程

```text
[ 正確流程 ]
Token 集中寫入 tokenManager (作為單一真相來源)
   │
   ▼
authStore 用 customRef 訂閱 tokenManager，以 computed 提供唯讀的 accessToken / isAuthenticated
   │
   ▼
登出時 logout() 先呼叫登出 API (此時 http.ts 仍帶著 token，後端才能列入黑名單)
   │
   ▼
無論 API 成敗，finally 呼叫 endSession()：clearAuth() 清 token + resetUserScopedStores()
   │
   ▼
回傳 { serverLoggedOut: true } 或 { serverLoggedOut: false, error }，由畫面決定訊息

[ 錯誤流程 ]
使用 persist 中間件將 Token 存於 Store 與 LocalStorage (產生雙重副本)
   │
   ▼
分散在各元件與 API Response 中手動寫入/修改 Token
   │
   ▼
登出時僅執行 clearAuth() 清除 Token，且 logout API 失敗就中斷
   │
   ▼
❌【問題】雙重副本同步失效，且 userStore 等敏感資料殘留未清空，使用者甚至登不出去
```

### 實作要點

- `customRef` 的 `set` 是空操作（唯讀），寫入只能經 `startSession` / `endSession`。
- `customRef` 內以 `onScopeDispose` 取消訂閱，避免測試反覆建立 Store 累積訂閱者。
- `logout()` 以 `logoutRequest` 保存進行中的 Promise，連點兩次只送一次 API。
- 註：`auth.ts` 註解提到 tokenManager 持久化的 localStorage key 為 `lookgo-auth`，與 CLAUDE.md「access token 只存記憶體」的描述不一致，**待確認**以 `services/tokenManager.ts` 為準。

## 2. userStore (使用者資料與併發快取)

### 對外介面

| 成員            | 說明                                                                |
| :-------------- | :------------------------------------------------------------------ |
| `userInfo`      | 目前使用者資料（`CurrentUser \| null`）                             |
| `isAdmin`       | `userInfo.role === UserRole.ADMIN`                                  |
| `ensureUser()`  | 沒 token 回 `null` 不打 API；有資料直接回；請求中共用同一個 Promise |
| `refreshUser()` | 強制重抓（例如設定頁改資料後），會取代進行中的請求                  |
| `patchUser()`   | 後端修改 API 只回異動欄位（如頭像），合併回現有資料                 |
| `$reset()`      | 清資料並作廢進行中的請求（`userScoped`）                            |

### 流程

```text
[ 正確流程 ]
多個元件併發呼叫 ensureUser() (如 Layout / Header / Guard)
   │
   ▼
Store 檢查已有資料 (userInfo) 或進行中的 Promise (pending)
   │
   ├─► 已有資料/請求中：直接回傳既有資料或 Promise (共用請求，僅發 API 一次)
   │
   └─► 無資料：fetchUser() 發 API，請求編號 latestRequestId + 1
          │
          ▼
       回應回來時比對編號
          ├─► 仍是最新：寫入 userInfo
          └─► 已過期 (期間登出 / 換帳號 / 有更新請求)：不寫入

[ 錯誤流程 ]
多個元件在 mount 時各自呼叫 getCurrentUser()
   │
   ▼
未經併發鎖定，重複發送 3 次相同的 API 請求
   │
   ▼
各自 Response 回傳後直接 setState 寫入 Store
   │
   ▼
❌【問題】觸發競態衝突 (後回應覆蓋最新資料)、造成無效網路開銷，登出後上一位的資料還可能被寫回
```

### 實作要點

- 失敗時清掉 `pending` 並 **rethrow**（不吞錯），讓路由守衛能分辨 401 與網路錯誤。
- `$reset()` 讓 `latestRequestId++`，登出後才回來的回應會被丟棄。

## 3. metroMapStore (地圖資料與 Promise 共用)

Store 內分四區：路網圖、車站選項、起訖站路徑查詢、設施篩選。

### 對外介面

| 區塊       | 狀態                                                                     | Action                                |
| :--------- | :----------------------------------------------------------------------- | :------------------------------------ |
| 路網圖     | `lines`、`stations`(computed 去重)、`isMetroMapLoading`、`metroMapError` | `fetchMetroMap()`                     |
| 車站選項   | `stationOptions`、`isStationOptionsLoading`、`stationOptionsError`(字串) | `fetchAllStationOption(force?)`       |
| 起訖站路徑 | `routeResult`、`isRouteLoading`、`routeError`                            | `fetchRoute(request)`、`clearRoute()` |
| 設施篩選   | `selectedFacilities`                                                     | `setSelectedFacilities()`             |

### 流程

```text
[ 正確流程 ]
多個卡片元件同時呼叫 fetchMetroMap()
   │
   ▼
已有 lines：直接回傳；否則 Store 保存進行中的 Promise (metroMapRequest) 共用請求
   │
   ├─► 請求成功：寫入地圖路線 (lines)，stations 由 computed 依 stationCode 去重 (轉乘站只留一次)
   │
   └─► 請求失敗：將錯誤寫入 metroMapError (不直接彈窗，交由 UI 控制)；結束後解除共用，可重試

[ 錯誤流程 ]
各卡片元件 mount 時個別觸發 API 請求
   │
   ▼
缺乏 Promise 快取，導致瞬間重複發送 8 次 get-metro-map 請求
   │
   ▼
API 失敗時直接在 Store 內部呼叫 enqueueSnackbar()
   │
   ▼
❌【問題】無效重複請求、多卡片同時失敗引發 UI 彈窗洗版破壞解耦
```

### 起訖站路徑查詢（防競態）

- `fetchRoute` 用 `latestRouteRequestId`：先查 A→B 再查 A→C，A→B 較晚回來也不會蓋掉 A→C。
- 開始查詢就清空 `routeResult` / `routeError`，畫面不會在查新路線時顯示舊路線。
- `clearRoute()` 也會讓編號 +1，進行中的查詢回來後不再寫入。
- 所有 fetch 類 action **不會 reject**，失敗看對應的 `xxxError`。

### 注意

- `selectedFacilities` 在 `metroMapStore` 與 `stationStore` 各有一份，兩者是否為刻意分開、或應合併，**待確認**。

## 4. stationStore (車站詳情與最新回應防競態)

### 對外介面

| 成員                                           | 說明                                          |
| :--------------------------------------------- | :-------------------------------------------- |
| `currentStationCode`                           | 目前選取的站碼                                |
| `stationDetail`                                | 車站詳情                                      |
| `isStationLoading` / `stationError`            | 載入中 / 錯誤（`asApiError` 轉成 `ApiError`） |
| `selectedFacilities`                           | 設施篩選                                      |
| `selectStation(code)`                          | 選站並查詢，**不會 reject**                   |
| `clearSelection()`                             | 取消選取，並讓進行中的查詢作廢                |
| `toggleFacility()` / `setSelectedFacilities()` | 切換單一設施 / 整批設定（皆建立新陣列）       |

### 流程

```text
[ 正確流程 ]
使用者快速切換車站 (A站 ──► B站)
   │
   ▼
Store 遞增請求編號 (latestRequestId + 1)，並將設施篩選收攏於 Store
   │
   ▼
selectStation 先清空 stationDetail / stationError，再帶上複製的篩選條件發請求
   │
   ▼
API 非同步回傳時，驗證回應編號是否為最新 (isLatest)
   │
   ├─► 是最新請求 (B站)：寫入 stationDetail 狀態
   │
   └─► 屬舊請求 (A站)：直接丟棄，防止舊資料覆蓋

[ 錯誤流程 ]
使用者快速切換車站 (A站 ──► B站)
   │
   ▼
未記錄請求編號，且將設施篩選分散於元件本地 state
   │
   ▼
A站請求因網路延遲較晚回傳，B站請求較早回傳
   │
   ▼
❌【問題】A站舊資料覆蓋 B站新資料 (競態衝突)，且篩選狀態與 Store 不同步
```

### 實作要點

- 送出請求時以 `[...selectedFacilities.value]` 複製，請求送出後使用者再改篩選不影響這次參數。
- `isStationLoading` 只在最新請求結束時才設為 `false`，避免舊請求提早關掉 loading。

## 5. stationBookmarkStore (書籤狀態與集中維護)

### 對外介面

| 成員                                         | 說明                                                                    |
| :------------------------------------------- | :---------------------------------------------------------------------- |
| `bookmarks` / `hasLoaded`                    | 書籤快取 / 是否已完整載入                                               |
| `isBookmarksLoading` / `bookmarksError`      | 載入狀態 / 錯誤                                                         |
| `bookmarkedStationIds`                       | 已收藏車站 id 的 `Set`（computed）                                      |
| `isBookmarked(stationId)`                    | 帶參數的 getter（computed 回傳函式）                                    |
| `pendingStationIds` / `isPending(stationId)` | 操作中的車站，按鈕可據此 disabled                                       |
| `ensureLoaded()`                             | 未登入或已載入就略過；併發共用 `loadRequest`；**不會 reject**           |
| `addBookmark()` / `removeBookmark()`         | 先 `waitForLoad()`，成功後同步快取；失敗 reject `ApiError`              |
| `toggleBookmark(stationId)`                  | 回傳 `'added' \| 'removed' \| 'login-required'`；失敗 reject `ApiError` |
| `$reset()`                                   | 清快取並作廢進行中的請求（`userScoped`）                                |

### 流程

```text
[ 正確流程 ]
使用者點擊書籤按鈕 (toggleBookmark)
   │
   ▼
未登入？ ──► 回傳 'login-required' (不打 API)，由畫面決定提示或導向登入
   │
   ▼
同一站已有進行中的操作 (toggleRequests)？
   │
   ├─► 有：回傳既有 Promise，阻擋重複點擊
   │
   └─► 無：記錄 pendingStationIds，執行 runToggle
          │
          ▼
       await ensureLoaded() 確保書籤清單已完整載入
          │
          ▼
       載入失敗 (bookmarksError)？ ──► 直接 throw，不亂猜新增或刪除
          │
          ▼
       已收藏 ──► removeBookmark ──► 'removed'
       未收藏 ──► addBookmark    ──► 'added'
          │
          ▼
       成功後同步更新 Store 清單；finally 清掉自己的 pending 記錄

[ 錯誤流程 ]
使用者點擊書籤按鈕
   │
   ▼
元件未確認資料是否載入，直接在本地用 bookmarks.find() 判斷
   │
   ▼
缺乏防重連點 (isPending) 控管
   │
   ▼
快速連點兩下，觸發兩次相同的「新增」或「刪除」API 請求
   │
   ▼
❌【問題】資料未載入導致狀態判斷錯誤，且觸發重複 API 請求產生 Bug (後端回「重複收藏」)
```

### 實作要點

- **`generation` 世代編號**：`$reset()` 時 +1；登出前發出的請求回來後，若世代不同就不寫入，避免污染下一位使用者的快取。
- **`waitForLoad()`**：新增 / 刪除前先等進行中的載入結束，避免載入結果晚回來蓋掉剛改的資料。
- `removeBookmark` 在快取尚未載入時也能刪除（書籤頁、地圖、旅程卡都走這裡）。
- `addBookmark` 寫入前檢查 `bookmarkedStationIds`，避免快取出現重複項目。
- `load()` 以 `page: 0, size: 1000`（`FETCH_ALL_SIZE`）一次抓全部書籤。

## 測試

每個 Store 都有對應 spec，位於 `src/stores/__tests__/`：`auth.spec.ts`、`user.spec.ts`、`metroMap.spec.ts`、`station.spec.ts`、`stationBookmark.spec.ts`。測試寫法見 `docs/testing/`。
