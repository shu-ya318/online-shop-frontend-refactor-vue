# HTTP 請求流程(src/services)

- 一次 API 請求從元件發起到拿到結果的完整路徑。所有請求只經 `services/http.ts` 的 `post<T>()` 送出,元件與 store 不直接使用 axios。
- 本篇只寫 HTTP,WebSocket 另見 [socket.md](./socket.md)(與 HTTP 共用同一個 `tokenManager`);錯誤分類另見 [error-handling.md](./error-handling.md)。

## 總流程圖

```
元件 (views/ · components/)
  │  呼叫 store action,或直接呼叫 service
  ▼
(可選)stores/*.ts
  ←  管理畫面狀態與快取;呼叫 service
  │
  ▼
services/<領域>/index.ts
  ←  各 API 函式，呼叫 post<T>(url, data)
  │
  ▼
services/http.ts   post<T>()
  ←  透過 axios 統一管理; 請求成功時回傳 response.data(型別 T)
  │
  ▼
services/http.ts   request interceptor
  ←  決定是否帶 Bearer token
  │
  │  token 快過期或讀不到 exp?
  ├─ 否 ───────────────────────────────┐
  │  是                                 │
  ▼                                     │
services/tokenManager.ts                │
  ←  getValidAccessToken():快過期才刷新;│
     同時有多個請求時，共用 1 次刷新          │
  │                                     │
  ▼                                     │
services/http.ts   refreshClient        │
  ←  無 interceptor 的獨立 axios,       │
     POST /auth/refresh-tokens          │
  │  (成功 → 寫入新 token 並通知訂閱者)  │
  ▼                                     │
  ◄─────────────────────────────────────┘
  │
  ▼
後端 Spring  /api/v1
  │
  ├─ 2xx ─────────► post 回傳 T ─────► 呼叫端拿到資料
  │
  ▼  失敗
services/http.ts   response interceptor
  ←  處理 401 刷新重送;其餘一律轉 ApiError
  │
  │  收到 401,能靠「刷新後重送」解決嗎? 完全符合 3 條件才重送:
  │    ① 是 token 失效,而非帳密錯誤 (端點不在 NO_REFRESH_ON_401 內)
  │    ② 這次請求有帶 token
  │    ③ 這次請求尚未重送
  ├─ 全是 ─► tokenManager.refreshAfterUnauthorized()
  │          ├─ 拿到新 token ─► instance.request(config) 重送 1 次
  │          └─ 刷新失敗 ────► 往下走
  │  否
  ▼
services/errors.ts   toApiError()
  ←  所有失敗統一轉成 ApiError(kind / status / message / fieldErrors)
  │
  ▼
呼叫端 catch
  ←  isApiError() / getErrorMessage() 取得可顯示訊息


[旁支] 刷新失敗且後端回 401 / 403(當 refresh token 無效)
  │
  ▼
services/tokenManager.ts   expireSession()
  ←  清除 token;原本有登入時，才通知 onAuthExpired
  │
  ▼
router/authExpired.ts   installAuthExpiredHandler()
  ←  登入失效的 UI 處理(API 層不碰 router;路由守衛細節見 [router-flow.md](./router-flow.md))
  │
  ├─► stores/plugins/userScoped.ts   resetUserScopedStores():清空 user、stationBookmark
  ├─► composables/notify.ts          顯示「登入已失效」
  └─► router.push(login?redirect=)   僅當前頁面需要登入 / 管理員


[狀態同步] token 任何變化(登入、刷新、登出、失效)
  │
  ▼
stores/auth.ts
  ←  customRef 訂閱 tokenManager,讓 isAuthenticated 即時更新畫面
```

## 檔案分工

依流程出現順序排列。

| 檔案                           | 職責                                                      |
| ------------------------------ | --------------------------------------------------------- |
| `services/<領域>/index.ts`     | 各 API 函式,一律呼叫 `post<T>(url, data)`                 |
| `services/<領域>/interface.ts` | 該領域 request / response 型別                            |
| `services/http.ts`             | 建立 axios 實例與兩個 interceptor、匯出 `post`            |
| `services/tokenManager.ts`     | token 存取、快過期判斷、single-flight 刷新、登入失效通知  |
| `services/errors.ts`           | 把任何錯誤轉成 `ApiError`(見 error-handling.md)           |
| `router/authExpired.ts`        | 註冊登入失效處理:重設 store、提示、必要時導到登入頁       |
| `stores/plugins/userScoped.ts` | 登記帶 `userScoped` 的 store,登出或失效時統一重設         |
| `stores/auth.ts`               | 登入 / 註冊 / 登出,並把 token 變化同步成 Pinia 響應式狀態 |

## 階段 1:【發送前】Token 儲存

**問題**

- **綁定 UI 層**:token 放在 UI 層的全域 store,service 無法獨立使用與測試。
- **重新整理即登出**:token 只放 JS 變數,F5 後歸零。

**目標**

- **登入不中斷**:重新整理頁面仍維持登入。
- **層級乾淨**:services 層零 UI 依賴。

**做法**

- **集中管理**:token 由 `tokenManager` 統一存取,service 不依賴任何 store。
- **持久化**:存 `localStorage`(key `lookgo-auth`);不可用時(隱私模式)退回記憶體。
- **可抽換儲存體**:以 `TokenStorage` 介面注入,測試換成假實作。
- **Refresh token**:由後端以 HttpOnly cookie 管理,前端不持有。

## 階段 2:【請求攔截器】取得有效 Token

**問題**

- **過期邊界**:剛好到期才算過期,請求送達時已失效而被 401。
- **壞 token 拖垮請求**:JWT 解碼例外發生在 interceptor,所有請求連帶失敗。
- **缺 exp 永不刷新**:沒有 `exp` 的 token 被視為永遠有效。
- **併發重複刷新**:5 個請求同時過期就刷新 5 次;後端若採 refresh token 輪替,第 2 次起全部失敗,使用者被誤登出。
- **刷新遞迴與循環依賴**:刷新請求自己也進 interceptor,只靠網址字串擋遞迴。

**目標**

- **N 請求只刷新 1 次**:無遞迴風險。
- **壞 token 可自我修復**:多刷新一次,不會讓請求失敗。
- **不存在登出後仍持有token情形**:不會把已登出的使用者又寫回 token。

**做法**

- **提前 30 秒刷新**:`isExpiring()` 以 `exp - 30s` 判斷;`exp` 讀不到也當作快過期。
- **解碼容錯**:`readTokenExpiry()` 包 `try/catch`,失敗回 `null`。
- **單一刷新**:`inFlight` 保存進行中的 Promise,並發請求共用同一次刷新。
- **獨立刷新通道**:`refreshClient` 不掛 interceptor,結構上不可能遞迴;`tokenManager` 不 import `auth`,消除循環依賴。
- **認證端點不帶 token**:`/auth/*` 一律不帶,僅 `/auth/log-out` 帶目前 token 供後端加入黑名單。
- **刷新失敗降級**:改成不帶 token 送出;需登入的 API 回 401,但因沒帶 token 不會再觸發刷新。
- **防止競態**:`runRefresh()` 比對刷新前後的 token;期間若重新登入就採用新 token,若已登出就丟棄結果。

### 備註： refreshClient 為何是獨立 axios?

- http.ts 的 instance 掛了 request interceptor。如果刷新請求也走 instance,就會有三個問題:

  - 無限遞迴:刷新請求進 request interceptor,interceptor 發現 token 快過期,又去刷新,刷新請求再進 interceptor,永遠繞不出來。
  - 誤判:刷新自己若收到 401,會進 response interceptor 再觸發一次刷新。原本只靠 url.includes(...) 字串比對擋,改網址就失效。
  - 循環依賴:原本 interceptor 呼叫 auth 的刷新函式,而 auth 又 import api。

## 階段 3:【請求執行】發送與型別

**問題**

- **型別被繞過**:舊版以 `as unknown as Promise<T>` 強轉,TypeScript 不檢查;欄位名與後端不符(`successMessage` vs `message`)長期未被發現。
- **難以測試**:只有寫死的全域 client,測試得打真網路或全域 mock。

**目標**

- **編譯期就能找出錯誤**:前後端欄位不一致在編譯時就會報錯。
- **免後端測試**:interceptor、刷新、重送整條流程可離線驗證。

**做法**

- **泛型推導**:`instance.post<T>()` 讓 `response.data` 自然為 `T`,函式內無任何 `as`。
- **單一出口**:response interceptor 只掛錯誤處理,成功值由 `post` 回傳 `response.data`。
- **可注入工廠**:`createHttpClient({ adapter, storage, onAuthExpired })`;正式程式碼使用預設實例 `httpClient`。
- **請求內容寬鬆**:`data` 型別為 `unknown`。
- **長任務逾時**:預設逾時 10 秒;`metroSync` 以 `LONG_RUNNING_TIMEOUT_MS`(15 分鐘)覆寫。

## 階段 4:【回應處理】401 與錯誤轉換

**問題**

- **業務 401 誤判**:帳密錯誤、舊密碼錯誤也回 401,卻被當成 token 失效而登出。
- **不重送**:token 傳輸中過期的 401 應刷新後重送,舊版直接登出。
- **網路斷線誤登出**:刷新因斷線失敗,也被當成登入失效。
- **API 層導頁**:直接改 `window.location`,整頁重載、無法測試、繞過 Router。
- **403 被誤導頁**:403 是無權限而非登入失效,卻統一跳轉登入頁。

**目標**

- **密碼打錯時不登出**:token 過期時使用者幾乎無感。
- **弱網不誤登出**:只有 refresh token 真的無效才登出。
- **API 層無 UI 副作用**:可單元測試。

**做法**

- **業務 401 白名單**:`NO_REFRESH_ON_401` 涵蓋 `/auth/*` 與 `/user/update-password`,不刷新、不重送。**修改 `http.ts` 時不可破壞。**
- **刷新後重送一次**:其餘 401 須同時滿足「有帶 token」「未重送過」,以 `_retried` 防無限重試。
- **避免重複刷新**:`refreshAfterUnauthorized()` 發現 token 已被別的請求換新,直接沿用。
- **嚴格判定失效**:僅刷新回 401 / 403(`isSessionExpiredError`)才呼叫 `expireSession()`;網路錯誤保留登入狀態。
- **副作用上移**:API 層只呼叫注入的 `onAuthExpired`;`router/authExpired.ts` 負責重設 store、提示與導頁(`login?redirect=`)。
- **403 交還呼叫端**:與其他錯誤一樣轉成 `ApiError`,由呼叫端決定處理。
- **統一出口**:最後一律 `throw await toApiError(error)`。

## 其他零碎調整

- **metro 型別**:`metro/interface.ts` 設施欄位(`atm`、`elevator` 等)改為 `string | null`,新增 `locker`;移除 `getAllStationFare`;`updatedAt` 為不帶時區的 UTC 字串。

## 待確認

- **後端刷新失敗狀態碼**:`isSessionExpiredError` 只認 401 / 403,需對照後端確認 refresh token 無效時實際回傳。
- **輪替未開啟時的定位**:若後端未啟用 refresh token 輪替,single-flight 仍可減少重複請求,但不再是必要條件。
- **`VITE_API_BASE_URL` 未生效**:`env/.env.example` 與 `env.d.ts` 有宣告,但 `http.ts` 的 `BASE_URL` 寫死 `'/api/v1'`,未讀取該變數。要接上還是移除宣告,待決定。
- **CLAUDE.md 與程式碼不一致**:CLAUDE.md 寫「access token 只存記憶體」,但 `tokenManager.ts` 實際存 `localStorage`(失敗才退回記憶體)。本篇以程式碼為準,CLAUDE.md 待修正。
