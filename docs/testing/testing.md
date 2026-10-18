# 測試寫法

說明單元測試「先寫哪裡、寫在哪、怎麼寫」。設定檔細節見 [vitest.md](./vitest.md)、[playwright.md](./playwright.md)。

## 撰寫順序

原則:由底層往上,依賴越少越先測。先測的東西,是後面測試的地基。

| 順序 | 範圍                                              | 為什麼放這裡                                       | 測試檔位置                  |
| ---- | ------------------------------------------------- | -------------------------------------------------- | --------------------------- |
| 1    | `utils/`:`date`、`validation`、`route`、`station` | 純函式,不用 mock,最容易寫                          | `src/utils/__tests__/`      |
| 2    | `services/errors.ts`                              | 所有失敗都經過它,`http` 與 store 都依賴它          | `src/services/__tests__/`   |
| 3    | `services/tokenManager.ts`                        | 登入狀態核心,single-flight 刷新最難寫對            | `src/services/__tests__/`   |
| 4    | `services/http.ts`                                | 依賴 1~3,用假 axios adapter,不打網路               | `src/services/__tests__/`   |
| 5    | `services/stationChat/socket.ts`                  | 依賴 token 與錯誤處理,需 mock STOMP                | `src/services/__tests__/`   |
| 6    | 各領域 `services/<領域>/index.ts`                 | 只是 `post<T>()` 的薄包裝,mock `http` 驗路徑與參數 | `src/services/__tests__/`   |
| 7    | `stores/`:`auth` → `user` → `station` → 其餘      | 依賴 services;先測 `auth` 與 `userScoped` 重置機制 | `src/stores/__tests__/`     |
| 8    | `router/`:`guards`、`authExpired`、`redirect`     | 依賴 store 與 tokenManager                         | `src/router/__tests__/`     |
| 9    | 元件:只測有互動邏輯的(如 `UserProfileMenu`)       | 最慢、最容易因 UI 改動而壞                         | `src/components/__tests__/` |
| 10   | E2E:登入 → 查地圖 → 收藏等關鍵流程                | 最後驗收,只寫少數幾條                              | `e2e/`                      |

橫跨多層的測試(如 `App.spec.ts`)放 `src/__tests__/`;`vuetify.spec.ts` 因為對照 `plugins/vuetify.ts` 與 `styles/settings.scss`,放 `src/plugins/__tests__/`。

## 目前進度

依 `src/` 現況整理,只列檔案是否存在,不代表內容完整。

| 範圍       | 已有檔案                                 | 空檔(0 行)                               | 尚未建立                    |
| ---------- | ---------------------------------------- | ---------------------------------------- | --------------------------- |
| utils      | `date`、`validation`、`route`、`station` |                                          |                             |
| services   | `errors`、`http`、`tokenManager`         |                                          | `socket`、各領域 `index.ts` |
| stores     | `auth`、`user`                           | `station`、`stationBookmark`、`metroMap` |                             |
| router     | `guards`                                 | `authExpired`、`redirect`                |                             |
| components | (無)                                     | `UserProfileMenu`                        | 其餘元件                    |
| 其他       | `App`、`vuetify`                         |                                          |                             |
| e2e        | `e2e/app.spec.ts`                        |                                          | 登入、查地圖、收藏流程      |

## services 核心測試的情境

依 `src/services/__tests__/` 現有 spec 整理(依撰寫順序),案例數以檔案內實際 `it` 為準。

### 1. errors.spec.ts(目前 41 個案例)

測試檔內每組案例上方以 `// Scenario:` 標註情境。

| 區塊                             | 情境                                                                                                                  |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `toApiError`:HTTP 有回應         | 驗證 map 轉 `fieldErrors` 且 `message` 以「、」串接;`{message}`;Blob 內含 JSON;Blob 非 JSON 退回預設訊息              |
|                                  | map 含前端沒有的欄位原樣保留;HTML 錯誤頁用狀態碼預設訊息;400/401/403/404/409/5xx/其他 的預設文案;`cause` 保留         |
| `toApiError`:無回應或非 HTTP     | 逾時(`ECONNABORTED`、`ETIMEDOUT`);網路錯誤;取消(先於 network 判斷);非 axios 錯誤轉 `unknown`;已是 `ApiError` 原樣回傳 |
| `parseErrorBody`                 | `message` 優先於 map;JSON 字串;空白 `message`;map 含空白訊息;map 全空白;含非字串值;無法解析的 body 回傳 `{}`          |
| `isApiError` / `getErrorMessage` | type guard;`ApiError` 回其 `message`;其他回 fallback(預設或自訂)                                                      |

「後端不存在的欄位」目前解讀為 map 含前端表單沒有的欄位名稱;若原意不同,待確認。

### 2. tokenManager.spec.ts(目前 29 個案例)

測試檔內每組案例上方以 `// Scenario:` 標註情境。

| 區塊                       | 情境                                                                                                              |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `readTokenExpiry`          | 回傳 `exp` 秒數;非 JWT 或無 `exp` 回傳 null                                                                       |
| `getValidAccessToken`      | 無 token 回 null 不刷新;有效直接回傳;leeway 內先刷新;leeway 邊界(30 秒刷新、31 秒不刷新);壞掉的 JWT 視為快過期    |
| single-flight              | 3 個請求同時只刷新 1 次;刷新進行中呼叫 `getValidAccessToken` 共用同一次;結束後可再刷新;失敗時全部一起失敗且可重試 |
| session 失效               | refresh 401/403 清除並通知一次;401 時 token 已被換掉不清除;網路錯誤保留登入;刷新期間重新登入或登出                |
|                            | `expireSession`(未登入不通知、已登入清除並通知);`clearAuth` 不通知;`setOnAuthExpired` 換掉或停用                  |
| `refreshAfterUnauthorized` | token 已被換新直接回傳;沒變則刷新;刷新失敗回 null                                                                 |
| `setAccessToken`           | 傳入 token 寫入並通知訂閱者;傳 null 清除                                                                          |
| `subscribe`                | token 變化通知訂閱者;取消訂閱後不再通知                                                                           |
| `createLocalTokenStorage`  | `localStorage` 可用時以指定 key 讀寫;不可用退回記憶體                                                             |

### 3. http.spec.ts(目前 22 個案例)

測試檔內每組案例上方以 `// Scenario:` 標註情境;用假 adapter 串起 interceptor、`tokenManager`、`errors`,不打網路。

| 區塊            | 情境                                                                                                                                    |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| request         | POST 回傳 `response.data`、帶 baseURL/body/query string;逾時預設 10 秒、可覆寫;一般 API 帶 Bearer;公開 API 無 token 照樣成功            |
| auth 端點白名單 | `/auth/*`(含 query string)不帶 Authorization;`log-out` 例外要帶;`log-in` 401 與 `update-password` 401 不刷新、不登出、token 保留        |
| 401 刷新後重送  | 刷新一次後用新 token 重送;重送仍 401 不再重試;3 個請求同時 401 只刷新 1 次;送出前已過期只刷新 1 次;沒帶 token 的 401 不刷新             |
| 刷新失敗        | refresh 被拒:清除 token、`onAuthExpired` 只通知一次、回拋原本 401(含 3 個並行);預先刷新遇網路錯誤:改不帶 token 送出、不再刷新、保留登入 |
| 錯誤轉換        | 403 不刷新不登出、不導頁;5xx 預設文案;400 驗證 map 轉 `fieldErrors`;Blob 錯誤 body;逾時;網路不通                                        |

`NO_REFRESH_ON_401`(`/auth/*`、`/user/update-password`)是改 `http.ts` 最容易破壞的規則,動到時務必確認「白名單」與「401 刷新後重送」兩區全綠。

## 分 session 撰寫(建議)

每個 session 開頭先 `/clear`,避免前一份檔案的細節干擾下一份。

| session | 內容                                       | 原因                                 |
| ------- | ------------------------------------------ | ------------------------------------ |
| 1       | `errors.ts` → `errors.spec.ts`             | 最底層,後面都依賴它                  |
| 2       | `tokenManager.ts` → `tokenManager.spec.ts` | 競態情境複雜,需要獨立的上下文        |
| 3       | `http.ts` → `http.spec.ts`                 | 依賴前兩者,用假 adapter 串起整條流程 |

每個 session 結束前跑該 spec,再跑「必跑的測試」一次。

## 目錄與命名

- 單元測試放在被測層級的 `__tests__/` 下,檔名 `*.spec.ts`,例如 `src/services/__tests__/errors.spec.ts`。
- 共用工具放 `src/test/`:`setup.ts`(補 `ResizeObserver`、`matchMedia`)、`testUtils.ts`(測試用 pinia)。
- 工具不放進 `__tests__/`,避免被當成測試檔。
- services、utils 的測試檔第一行加 `// @vitest-environment node`;元件測試維持預設的 jsdom。目前 `utils/` 與 `services/__tests__/` 的 `errors`、`http`、`tokenManager` spec 都已加。
- 路徑一律用 `@/` 別名,不寫 `../`。

## 撰寫原則

- 不打真實網路:HTTP 用假 axios adapter,WebSocket 用 mock。
- 時間相關測試不依賴真實時間:`tokenManager` 用注入的 `now` 參數固定時間;其他情況用假計時器。
- 時區已固定為 `Asia/Taipei`,日期測試不要再依賴本機時區。
- 一個測試只驗一件事,測試名稱直接寫出情境與預期結果。
- 常用的假資料(假 JWT、deferred promise、假 adapter)應集中放 `src/test/`。目前 `makeToken` 定義在 `tokenManager.spec.ts`、`http.spec.ts` 內(兩者簽章不同),`createDeferred` 在 `tokenManager.spec.ts`,`createHttpError` 在 `tokenManager.spec.ts`、`http.spec.ts`、`errors.spec.ts`(其中為 `httpError`)內,待抽出。
- `vi.fn()` 必須帶型別參數,例如 `vi.fn<() => void>()`,否則 oxlint 的 `vitest/require-mock-type-parameters` 會報錯。
- 情境標註:每組案例上方加 `// Scenario: 名稱 —— 說明`,與 `utils/__tests__/date.spec.ts` 一致。
- 新增 service / util / store 時,同一個 PR 補上對應 spec。

## 必跑的測試

| 改動內容                   | 必跑的 spec                                              |
| -------------------------- | -------------------------------------------------------- |
| token、錯誤處理、`http.ts` | `http.spec.ts`、`tokenManager.spec.ts`、`errors.spec.ts` |
| 其他                       | 對應檔案,最後跑全部                                      |

指令:

- 全部:`npm run test:unit`
- 單一檔案:`npx vitest run src/services/__tests__/errors.spec.ts`
- 通過標準:`npm run lint`、`npm run type-check`、`npm run test:unit` 全綠。
