# 錯誤處理(src/services/errors.ts)

- 不論是後端回錯誤、逾時、斷網、取消,呼叫端(元件、store)都拿到同一種型別 `ApiError`,且 `message` 已是可直接顯示的繁中訊息。
- `errors.ts` 只負責「描述錯誤」,不導頁、不清狀態;登入失效流程見 [request-flow.md](./request-flow.md) 階段 4,WebSocket 錯誤見 [socket.md](./socket.md)。

## 總流程圖

```
services/http.ts   response interceptor
  ←  401 刷新重送不成功,或其他失敗,最後一律 throw await toApiError(error)
  │
  ▼
services/errors.ts   toApiError(error)
  │
  │  步驟 ① 已經是 ApiError?
  ├─ 是 ─► 原樣回傳(避免被包兩次)
  │  否
  │
  │  步驟 ② axios.isCancel(error)?(取消也是 AxiosError,所以最先判斷)
  ├─ 是 ─► kind: 'canceled',message 取 KIND_MESSAGES.canceled
  │  否
  │
  │  步驟 ③ axios.isAxiosError(error)?
  ├─ 否 ─► kind: 'unknown',message 取 KIND_MESSAGES.unknown
  │  是
  │
  │  步驟 ④ 有 response?
  ├─ 沒有 ─► code 是 ETIMEDOUT / ECONNABORTED?
  │          ├─ 是 ─► kind: 'timeout',message 取 KIND_MESSAGES.timeout
  │          └─ 否 ─► kind: 'network',message 取 KIND_MESSAGES.network
  │  有
  ▼
步驟 ⑤ readBody(response.data)
  ←  body 是 Blob(responseType: 'blob')就先 await data.text()
  │
  ▼
步驟 ⑥ parseErrorBody(body)
  ←  取出 { message?, fieldErrors? };格式不符回 {}
  │
  ▼
步驟 ⑦ 組成 kind: 'http' 的 ApiError
  ←  message ?? messageForStatus(response.status)
     後端有給可用 message 就沿用;沒有才呼叫 messageForStatus
     (messageForStatus 只會在此步驟被呼叫)
  │
  ▼
呼叫端 catch
  ←  isApiError() 判斷型別;getErrorMessage() 取得可顯示訊息
```

`messageForStatus` 只在步驟 ⑦ 出現,且前提是步驟 ⑥ 沒解析出 `message`。步驟 ①~④ 的訊息都來自 `KIND_MESSAGES`,不經過它。

## 檔案分工

依流程出現順序排列。

| 位置(`services/errors.ts`) | 職責                                                                  |
| -------------------------- | --------------------------------------------------------------------- |
| `ApiError`                 | 統一錯誤型別,繼承 `Error`,帶 `kind`、`status`、`fieldErrors`、`cause` |
| `toApiError()`             | 把任何錯誤轉成 `ApiError`,依上圖順序判斷                              |
| `readBody()`               | Blob 錯誤 body 先讀成文字                                             |
| `parseErrorBody()`         | 解析後端 body,取出 `message` 與 `fieldErrors`                         |
| `KIND_MESSAGES`            | 逾時、斷網、取消、未知的預設訊息                                      |
| `messageForStatus()`       | HTTP 狀態碼的預設訊息                                                 |
| `isApiError()`             | type guard                                                            |
| `getErrorMessage()`        | ApiError 回傳其 `message`,其他錯誤回傳 fallback                       |

`ApiError` 欄位:

| 欄位          | 意義                                                              |
| ------------- | ----------------------------------------------------------------- |
| `kind`        | `'http'` / `'timeout'` / `'network'` / `'canceled'` / `'unknown'` |
| `status`      | HTTP 狀態碼;逾時、斷網、取消為 `0`                                |
| `message`     | 可直接顯示給使用者的訊息                                          |
| `fieldErrors` | 後端驗證失敗的「欄位 → 訊息」,只有後端回驗證 map 時才有值         |
| `cause`       | 原始錯誤,除錯用                                                   |

## 階段 1:【統一型別】reject 的值

**問題**

- **reject 字串**:舊版 reject 的是字串(甚至 `string[]`,來自 `data.files`),呼叫端要自己猜型別。
- **沒有狀態碼**:元件分不出 404 與 500,只能比對字串(例如 `'NetworkError'`),文字一改全壞。
- **丟掉原始錯誤**:字串不是 `Error`,看不到 stack trace,也違反 ESLint `prefer-promise-reject-errors`。
- **interceptor 內 `console.error`**:每個失敗請求都印一次 `response.data`,可能把敏感資料印到 console。

**目標**

- **單一型別**:所有失敗都是 `ApiError`,可用 `kind` / `status` 判斷,不比對字串。
- **保留除錯資訊**:原始錯誤放 `cause`。

**做法**

- **繼承 `Error`**:`ApiError` 用 `super(message, { cause })` 保留原始錯誤,`name` 為 `'ApiError'`。
- **欄位唯讀**:`kind`、`status`、`fieldErrors` 皆 `readonly`。
- **單一出口**:response interceptor 最後一行 `throw await toApiError(error)`,不再 `console.error`。
- **不重複包裝**:已是 `ApiError` 就原樣回傳。
- **呼叫端寫法**:

```ts
try {
  await login(form)
} catch (error) {
  if (isApiError(error) && error.fieldErrors) {
    // 逐欄顯示
  } else {
    notify.error(getErrorMessage(error))
  }
}
```

## 階段 2:【分類】判斷順序與種類

**問題**

- **逾時被當斷網**:axios 逾時時 `error.response` 也是 `undefined`,舊版一律回 `'NetworkError'`,使用者看到「網路錯誤」,實際是伺服器太慢。
- **訊息是英文單字**:`'Canceled'`、`'unknown error'` 不能直接給使用者看。
- **沒有狀態碼預設訊息**:後端回 502 時 body 常是 HTML 或空的,只能顯示 `'unknown error'`。
- **取消被誤分類**:取消也是 `AxiosError`,若先判斷 `isAxiosError` 會被當成斷網。

**目標**

- **種類分開**:逾時、斷網、取消、HTTP、未知各有 `kind`。
- **一律有可顯示訊息**:即使 body 解析不出來。

**做法**

- **判斷順序**:ApiError → `axios.isCancel` → `axios.isAxiosError`(無 response 再分逾時 / 斷網)→ 其他為 `unknown`。
- **逾時判定**:`error.code` 為 `ETIMEDOUT` 或 `ECONNABORTED`。
- **非 HTTP 種類的訊息**:查 `KIND_MESSAGES`。
- **HTTP 訊息**:後端有給 `message` 就用,否則用 `messageForStatus(status)`。
- **非 HTTP 種類的訊息**(`KIND_MESSAGES`)出現的步驟:

| kind       | 訊息                          | 出現步驟                          |
| ---------- | ----------------------------- | --------------------------------- |
| `canceled` | 請求已取消                    | 步驟 ②                            |
| `unknown`  | 發生未預期的錯誤,請稍後再試   | 步驟 ③(非 axios 錯誤)             |
| `timeout`  | 請求逾時,請稍後再試           | 步驟 ④(無 response,且為逾時 code) |
| `network`  | 網路連線異常,請檢查網路後再試 | 步驟 ④(無 response,且非逾時 code) |

- **`messageForStatus` 各狀態碼**(皆在步驟 ⑦,且步驟 ⑥ 沒解析出 `message`):

| 狀態碼 | 預設訊息                    | 出現步驟 | 補充                                                               |
| ------ | --------------------------- | -------- | ------------------------------------------------------------------ |
| 400    | 請求內容有誤                | 步驟 ⑦   | 後端有回 `message` 或驗證 map 時,走步驟 ⑥ 的訊息,不用此預設值      |
| 401    | 登入已失效,請重新登入       | 步驟 ⑦   | 帳密錯誤等業務 401 若後端有帶 `message`,以後端訊息為準             |
| 403    | 沒有權限執行此操作          | 步驟 ⑦   | 403 不導頁,轉成 `ApiError` 交還呼叫端                              |
| 404    | 找不到資料                  | 步驟 ⑦   |                                                                    |
| 409    | 資料衝突,請重新整理後再試   | 步驟 ⑦   |                                                                    |
| ≥ 500  | 伺服器發生錯誤,請稍後再試   | 步驟 ⑦   | 502 等 body 常為 HTML 或空,步驟 ⑥ 回 `{}`,所以幾乎都用此預設值     |
| 其他   | 發生未預期的錯誤,請稍後再試 | 步驟 ⑦   | 取 `KIND_MESSAGES.unknown`,與 `kind: 'unknown'` 同字串但 kind 不同 |

- 狀態碼 `0`(逾時、斷網、取消)不會進入 `messageForStatus`,因為這些情況在步驟 ②~④ 就結束,走不到步驟 ⑦。

## 階段 3:【解析】後端 body 格式

**問題**

- **驗證 map 被吃掉**:Spring Bean Validation 失敗回 `{ "cellphone": "格式錯誤", "email": "不可為空" }`,沒有 `message` 欄位,舊版得到 `'unknown error'`。
- **body 是字串**:CORS 被拒、nginx 回 HTML 錯誤頁時 `response.data` 是字串,舊版 `typeof data === 'object'` 為假,直接 `'unknown error'`。
- **Blob 錯誤讀不到**:`responseType: 'blob'`(例如下載 PDF)的請求,錯誤 body 也是 `Blob`,舊版完全讀不到訊息。

**目標**

- **驗證失敗可逐欄顯示**:同時保留整串訊息。
- **任何 body 都不會讓解析丟例外**。

**做法**

- **`readBody`**:body 是 `Blob` 就 `await data.text()`;讀取失敗回 `undefined`。
- **`parseErrorBody` 步驟**:
  1. 字串先 `JSON.parse`,失敗(HTML、純文字)回 `{}`。
  2. 不是純物件(含陣列、`null`)回 `{}`。
  3. `message` 為非空字串 → 只回 `{ message }`。
  4. 否則所有值都是字串 → 視為驗證 map:`fieldErrors` 保留原樣,`message` 為非空訊息以「、」串接。
  5. 都不符合,或串接後為空 → `{}`,由 `messageForStatus` 補預設訊息。
- **統一格式**:`ApiError.message` 一律可直接顯示。

## 階段 4:【邊界】errors.ts 不處理的事

- **登入失效**:401 / 403 的 token 刷新、`expireSession()`、導頁都在 `tokenManager` 與 `http.ts`,見 [request-flow.md](./request-flow.md) 階段 4。
- **導頁與清狀態**:`errors.ts` 不做任何副作用,方便單元測試(`services/__tests__/errors.spec.ts`)。
- **全域未捕捉錯誤**:由 `plugins/errorHandling.ts` 捕捉。

## 與舊版的差異

| 項目         | 原本                  | 現在                                     |
| ------------ | --------------------- | ---------------------------------------- |
| reject 的值  | 字串或 `string[]`     | `ApiError`(有 kind/status/message/cause) |
| 逾時 vs 斷網 | 都是 `'NetworkError'` | `timeout` / `network` 分開               |
| 驗證失敗     | `'unknown error'`     | `fieldErrors` 可逐欄顯示                 |
| HTML 錯誤頁  | `'unknown error'`     | 依狀態碼顯示預設訊息                     |
| Blob 錯誤    | 讀不到                | 先轉文字再解析                           |
| 訊息語言     | 英文單字              | 繁體中文,可直接顯示                      |

## 待確認

- **舊格式 `data.error.message` / `data.files`**:新版不再讀取。若後端有端點仍用這兩種格式(例如檔案上傳失敗回 `files`),訊息會退回狀態碼預設訊息;需對照 `GlobalExceptionHandler` 再決定是否補回。
- **`message` 與驗證 map 並存**:`parseErrorBody` 只要 `message` 為非空字串就不回 `fieldErrors`;若驗證欄位剛好叫 `message`,會被當成整串訊息。是否需要處理,待對照後端。
- **WebSocket 重用**:舊文件寫 `parseErrorBody` 被 socket 錯誤佇列重用,本次未讀 `services/stationChat/socket.ts`,待確認。
- **`as FieldErrors`**:`parseErrorBody` 內用了型別斷言,與 CLAUDE.md「盡量避免 `as`」不完全一致;是否改寫,待決定。
