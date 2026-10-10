# API 層(src/services)之調整與優化

所有 service 都經過同一個函式送出請求。設計本身是好的,問題在於它怎麼「得到」型別 `T`。

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

- interceptor 成功分支原樣回傳 `response`,不拆 data;錯誤分支維持原本的訊息整理邏輯。
- 由 `post` 自己 `return response.data`。

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
- `TokenManager`(`getAccessToken` / `setAccessToken` / `clearAuth`)取代對 store 的直接依賴,之後可在 Pinia store 建立後接上。
- 刷新 token 直接用 `instance.post<AuthResponse>('/auth/refresh-tokens')`,不再 import `auth`,循環依賴消失。
- 各 service 由 `import postRequest from '../api'` 改為 `import { post } from '../http'`;`stationChat/socket.ts` 改用 `tokenManager`。
- `data` 型別由 `object` 改為 `unknown`。

### 效益

- services 不依賴任何 UI 層 store,可獨立測試。
- 沒有循環依賴,載入順序不再影響行為。
- 驗收:`vue-tsc` 對 `src/services` 沒有任何錯誤。

## 待辦

- 建立 Pinia auth store 後,把 `tokenManager` 的讀寫改接到 store(目前為記憶體內變數,重新整理頁面會遺失)。
