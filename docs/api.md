# API 層(src/services)之調整與優化

所有 service 都經過同一個函式 `post` 送出請求,`post` 定義在 `src/services/http.ts`。本篇記錄 HTTP 與 token 管理「原本哪裡錯、為什麼錯、改成什麼」。

相關文件:錯誤轉換見 [error-handling.md](./error-handling.md),WebSocket 見 [socket.md](./socket.md)。

## 檔案分工

| 檔案                           | 職責                                                               |
| ------------------------------ | ------------------------------------------------------------------ |
| `services/<領域>/index.ts`     | 各 API 函式,一律呼叫 `post<T>(url, data)`                          |
| `services/<領域>/interface.ts` | 該領域 request/response 的型別                                     |
| `services/http.ts`             | 建立 axios instance、request/response interceptor、`post`          |
| `services/tokenManager.ts`     | access token 的存取、判斷快過期、刷新(single-flight)、登入失效通知 |
| `services/errors.ts`           | 把任何錯誤轉成 `ApiError`(見 error-handling.md)                    |
| `stores/authStore.ts`          | 把 tokenManager 的狀態同步成 Pinia 的響應式狀態                    |

## 1. `as unknown as Promise<T>`:型別被硬改

### 錯誤的現象和理由

- 原 `api.ts` 第 104 行 `service.post(...) as unknown as Promise<T>`:先把型別轉成 `unknown`,再轉成任何型別,TypeScript 在這裡完全不檢查。
- `T` 寫什麼都會通過。`common/interface.ts` 寫成 `successMessage`,後端實際回 `message`,就是因為這樣一直沒被發現。

### 調整作法

- 改用 axios 泛型 `instance.post<T>()`,`response.data` 的型別自然就是 `T`,函式內沒有任何 `as`。
- 同步把 `common/interface.ts` 的 `ApiResponse.successMessage` 改成 `message`。

### 效益

- 型別與後端不一致時,編譯期就會被抓到,而不是執行時拿到 `undefined`。
- 移除唯一一處型別斷言,之後讀程式碼不必再懷疑「這個 T 是真的嗎」。

## 2. response interceptor 拆掉 `response.data`

### 錯誤的現象和理由

- 原 `api.ts` 第 59–61 行 interceptor 直接回傳 `response.data`,但 axios 的型別不知道這件事,`service.post()` 的型別仍是「回傳 AxiosResponse」。
- 型別和實際拿到的東西不一樣,只能靠第 1 點的轉型補救。之後若有人直接用 `service.post`,會照型別去讀 `res.data.xxx`,執行時拿到 `undefined`。

### 調整作法

- interceptor 成功分支不處理(`response.use(undefined, onError)` 只掛錯誤處理),由 `post` 自己 `return response.data`。

### 效益

- 型別、interceptor、實際回傳值三者一致,單一出口(`post`)負責拆 data。
- 直接使用 `instance` 的人也不會被型別誤導。

## 3. 檔案與介面調整(`api.ts` → `http.ts`)

### 錯誤的現象和理由

- 原本匯出一個 `default postRequest`,token 直接綁 React 的 zustand store(`useAuthStore.getState()`);Vue 版沒有這個 store,`api.ts` 與 `stationChat/socket.ts` 都因此找不到模組。
- 請求 interceptor 在 token 過期時呼叫 `auth/refreshTokens`,而 `auth` 又 import `api`,形成循環依賴。
- `data?: object` 擋掉了合理的請求內容。

### 調整作法

- 新增 `src/services/http.ts`,匯出 `httpClient`(`instance`、`tokenManager`、`post`),並具名匯出 `post`、`tokenManager`;刪除 `api.ts`。
- 刷新 token 改由 `tokenManager` 內部呼叫 `refreshClient`(第 5 點),不再 import `auth`,循環依賴消失;`auth/index.ts` 也不再對外提供 `refreshTokens`。
- 各 service 由 `import postRequest from '../api'` 改為 `import { post } from '../http'`。
- `data` 型別由 `object` 改為 `unknown`。

### 效益

- services 不依賴任何 UI 層 store,可獨立測試。
- 沒有循環依賴,載入順序不再影響行為。

## 4. token 只存在記憶體,且「快過期」判斷太粗糙

### 錯誤的現象和理由

原本的 `createTokenManager` 只是一個變數,request interceptor 這樣判斷:

```ts
const { exp } = jwtDecode(accessToken)
const isExpired = exp !== undefined && exp * 1000 < Date.now()
```

1. **重新整理頁面就登出**:`let accessToken` 存在 JS 記憶體,F5 後變回 `null`。
2. **剛好卡在過期邊緣**:`exp` 到了才算過期。請求發出時還有效、送到後端時已過期,後端回 401。
3. **壞 token 會讓請求炸掉**:`jwtDecode` 遇到格式錯誤的 token 會丟例外,例外發生在 interceptor 裡,所有請求都失敗,且沒有任何提示。
4. **沒有 `exp` 被當成永遠有效**:`exp !== undefined && ...` 讓缺少 `exp` 的 token 永遠不會被刷新。

### 調整作法(`tokenManager.ts`)

- `createLocalTokenStorage`:token 存 `localStorage`(key 為 `lookgo-auth`),`localStorage` 不能用時(隱私模式)退回記憶體變數。
- `readTokenExpiry`:用 `try/catch` 包住 `jwtDecode`,讀不到 `exp` 回傳 `null`。
- `isExpiring`:`exp * 1000 - leewayMs <= now()`,預設提前 30 秒(`DEFAULT_REFRESH_LEEWAY_MS`)就當作快過期;`exp` 讀不到也視為快過期,走刷新。
- `now`、`storage`、`leewayMs` 都可由參數注入,測試時可以假裝時間流逝。

### 效益

- 重新整理頁面不掉登入。
- 邊緣時間不會把「剛好過期」的 token 送出去。
- 壞 token 不會讓整個請求流程炸掉,而是多刷新一次。

## 5. 多個請求同時刷新 token(single-flight)

### 錯誤的現象和理由

原本過期時每個請求各自呼叫 `instance.post('/auth/refresh-tokens')`:

- 頁面一載入同時發 5 個請求 → 同時發出 5 次刷新。
- 刷新用的是同一個 `instance`,所以刷新請求本身也會進 request interceptor,只靠 `url.includes(REFRESH_URL)` 這個字串判斷擋掉遞迴,一改網址就失效。
- 若後端做 refresh token 輪替(一個 refresh token 只能用一次),第 2 次之後的刷新全部失敗,使用者被誤登出。

### 調整作法

- `tokenManager.refresh()` 用 `inFlight` 變數存「正在進行的刷新 Promise」,已有就直接回傳同一個,結束後 `finally` 清掉。
- `http.ts` 另建 `refreshClient`(沒有掛 interceptor)專門打 `/auth/refresh-tokens`,結構上不可能遞迴。
- `getValidAccessToken()`:有 `inFlight` 就等它;沒 token 回 `null`;沒快過期直接用;快過期才刷新。
- 刷新完成後檢查 `storage.get()` 與刷新前是否相同(`startedWith`):期間若使用者重新登入就改用新 token,若已登出就丟掉這次結果,不會把已登出的人又寫回 token。

### 效益

- N 個請求只會產生 1 次刷新。
- 沒有遞迴風險,也沒有「刷新到一半登出,結果又被登入」的競態。

## 6. 401 / 403 處理:不分青紅皂白登出並整頁跳轉

### 錯誤的現象和理由

原本的 response interceptor:

```ts
if (error.response?.status === 401) {
  tokenManager.clearAuth()
  if (!window.location.pathname.includes('/auth/login')) {
    window.location.href = '/auth/login'
  }
}
if (error.response?.status === 403) {
  window.location.href = '/unauthorized'
}
```

1. **業務 401 也被當成 token 失效**:登入帳密錯誤、修改密碼時舊密碼錯誤,後端也回 401。使用者只是打錯密碼,卻被清掉登入狀態。
2. **沒有重試**:access token 剛好在傳輸中過期的 401,應該刷新後重送一次,原本直接登出。
3. **刷新失敗一律登出**:網路斷線導致刷新失敗,也會清掉 token 並跳轉。
4. **API 層直接改 `window.location`**:整頁重新載入會丟掉所有狀態、無法在單元測試中執行、也繞過 Vue Router。
5. **403 整頁跳轉**:403 是「沒有權限」,不代表登入失效;由 API 層決定導頁會讓呼叫端無法自己處理。

### 調整作法

- `NO_REFRESH_ON_401`:`/auth/*` 與 `/user/update-password` 的 401 是業務錯誤,不刷新、不重送,直接轉成 `ApiError`。
- 其他端點的 401:若這次請求有帶 token(`config._sentToken`)、還沒重送過(`config._retried`)才刷新,成功就 `instance.request(config)` 重送一次;`_retried` 防止無限重試。
- `refreshAfterUnauthorized(sentToken)`:若 storage 裡的 token 已經和送出的不同,代表別的請求已刷新過,直接用新的,不再多刷新一次。
- 只有刷新的錯誤是 401 或 403(refresh token 無效),才算登入失效:`expireSession()` 清 token,並呼叫 `onAuthExpired`。網路錯誤不會登出。
- API 層不碰 `window.location`。`onAuthExpired` 由上層注入(`setOnAuthExpired`),目前 `authStore` 用它把 Pinia 狀態同步成登出;要跳轉登入頁再由 router 守衛或 store 處理。
- 403 與其他錯誤同樣只轉成 `ApiError`,交給呼叫端決定。

### 效益

- 密碼打錯不會被登出;token 過期對使用者幾乎無感(自動刷新後重送)。
- 網路不穩不會誤登出。
- API 層沒有 UI 副作用,可以單元測試。

## 7. 讓 HTTP 層可以測試

### 錯誤的現象和理由

- `createHttpClient` 沒有匯出,只有一個寫死的全域 client,測試只能打真的網路或全域 mock axios。

### 調整作法

- 匯出 `createHttpClient(options)`,`options` 可傳入:
  - `adapter`:換掉實際發送請求的函式(測試時回傳假回應)
  - `storage`:換成測試用的假儲存
  - `onAuthExpired`:觀察登出通知
- 正式程式碼仍使用 `export const httpClient = createHttpClient()` 產生的預設實例。

### 效益

- 測試能完整跑過 interceptor、刷新、重送流程,不需要後端。

## 8. 其他零碎調整

- `metroSync` 的同步 API 改傳 `{ timeout: 15 * 60 * 1000 }`:同步耗時很久,預設 10 秒一定逾時。
- `metro/interface.ts` 的設施欄位(`atm`、`elevator` 等)改為 `string | null`,並新增 `locker`;同時移除 `getAllStationFare` API 與其型別;`updatedAt` 註明是不帶時區的 UTC 字串。

## 待辦

- 對照後端確認:刷新失敗時回的是否為 401/403(`isSessionExpiredError` 只認這兩種)。
- 若後端的 refresh token 輪替未開啟,single-flight 仍有價值(減少重複請求),但不再是必要條件。
