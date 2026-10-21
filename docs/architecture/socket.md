# WebSocket / STOMP(src/services/stationChat/socket.ts)之調整與優化

站內聊天室用 STOMP over WebSocket。`connectStationChatSocket(stationId, handlers, options?)` 建立連線,回傳 `sendMessage`、`deleteMessage`、`disconnect`。

相關文件:token 刷新見 [request-flow.md](./request-flow.md),錯誤格式見 [error-handling.md](./error-handling.md)。

## 先認識幾個名詞

| 名詞                                  | 意思                                                                             |
| ------------------------------------- | -------------------------------------------------------------------------------- |
| STOMP                                 | 跑在 WebSocket 上的訊息協定,有 CONNECT、SUBSCRIBE、SEND(publish)、ERROR 等 frame |
| `beforeConnect`                       | stompjs 每次(重新)連線前會 `await` 的 callback,適合在這裡準備 token              |
| `onConnect`                           | 連線成功。每次重連都會再觸發一次,所以訂閱要寫在這裡                              |
| `reconnectDelay`                      | 斷線後自動重連的間隔(這裡是 5000 ms)                                             |
| `/topic/station-chat/{id}`            | 訂閱:該站的新訊息、刪除訊息事件                                                  |
| `/user/queue/errors`                  | 訂閱:只給自己的錯誤訊息(例如內容驗證失敗)                                        |
| `/app/station-chat/{id}/send-message` | 發送:送出訊息                                                                    |

## 1. 位址在模組載入時就算好

### 原本

```ts
const WS_URL = `${window.location.origin.replace(/^http/, 'ws')}/ws`
```

寫在檔案最上層,檔案一被 import 就執行。

### 問題

- 單元測試、預先載入時 `window.location` 可能不是想要的值,而且無法覆寫成測試用的伺服器。
- 開發環境前端與後端 port 不同時沒有地方可改。

### 正確

- 改成函式 `resolveBrokerUrl()`,連線時才計算,並允許用環境變數 `VITE_WS_URL` 覆寫(`env/.env.example` 已有)。
- `options.brokerURL` 可在測試中傳入。

## 2. token 刷新邏輯重複寫了一份,而且會把連線流程弄停

### 原本

```ts
beforeConnect: async () => {
  let accessToken = tokenManager.getAccessToken()
  if (accessToken) {
    const { exp } = jwtDecode(accessToken)
    const isExpired = !!exp && exp * 1000 < Date.now()
    if (isExpired) {
      try {
        const response = await refreshTokens()
        ...
      } catch {
        tokenManager.clearAuth()
        accessToken = null
      }
    }
  }
  client.connectHeaders = accessToken ? { Authorization: `Bearer ${accessToken}` } : {}
}
```

### 問題

1. **和 HTTP 層重複**:自己判斷過期、自己刷新。HTTP 請求同時也在刷新時,就變成同時兩次刷新(沒有 single-flight)。
2. **`jwtDecode` 可能丟例外**:token 壞掉時,例外發生在 `beforeConnect` 裡。stompjs 的連線流程會停在這裡,**也不會自動重連**,畫面卻沒有任何錯誤。
3. **刷新失敗後仍然連線**:`accessToken = null` 後送出沒有 token 的 CONNECT,後端一定拒絕,5 秒後重連、再被拒……**無限重連迴圈**。
4. 只清了 token,沒有通知 UI 登入已失效。

### 正確

- 一律用 `tokens.getValidAccessToken()`(single-flight,共用 HTTP 層的邏輯)。
- 所有錯誤都在 `beforeConnect` 內自己處理,不讓例外跑出去。
- 拿不到 token 就呼叫 `stop(訊息)`:標記 `isStopped`、`client.deactivate()`、`onConnectionChange(false)`、`onError(訊息)`,**不再重連**。
- 訊息會區分兩種情況:storage 裡還有 token,代表是刷新時網路出錯,提示「暫時無法連線,請稍後重新整理」;沒有 token 才是「登入已失效」。

## 3. 連線被後端拒絕(token 無效)時沒有處理

### 原本

只有 `onStompError: onError?.(frame.headers.message || ...)`,通知使用者而已,然後 stompjs 照常 5 秒後用**同一個 token** 重連,永遠被拒。

### 正確(`handleConnectRejected`)

後端只在 CONNECT 時驗證 token,所以「還沒連上就收到 ERROR frame」一定是 token 被拒:

```text
收到 ERROR frame,且 isConnected === false
 ├─ 還沒重試過(hasRetriedAuth=false)且有送出過 token
 │    → hasRetriedAuth = true
 │    → tokens.refreshAfterUnauthorized(sentToken)   (和 HTTP 401 同一套邏輯)
 │         ├─ 拿到新 token → 什麼都不做,等 5 秒後 stompjs 自動重連,beforeConnect 會拿到新 token
 │         └─ 失敗 / null → stop('登入已失效,請重新登入後再使用聊天室')
 └─ 已經重試過,仍被拒
      → stop(後端訊息)
      → tokens.expireSession()   清 token,通知 onAuthExpired
```

連線成功時(`onConnect`)把 `hasRetriedAuth` 重設為 `false`,所以每次成功連線後都還有一次機會。

已連上之後才收到的 ERROR frame,只是一般錯誤,直接 `onError`。

## 4. 收到的訊息沒有驗證

### 原本

```ts
const event = JSON.parse(message.body) as StationChatEvent
onEvent(event)
```

```ts
const body = JSON.parse(message.body) as Record<string, string>
const errorMessage = body.message ?? Object.values(body).join('、')
```

### 問題

- `JSON.parse` 遇到非 JSON 會丟例外,在 stompjs 的 callback 裡丟例外會讓後續訊息處理出問題。
- `as StationChatEvent` 只是告訴 TypeScript「相信我」,實際內容是什麼沒人檢查。

### 正確

- `parseJson`:失敗回傳 `undefined`,不丟例外。
- `isStationChatEvent`(type guard):確認是物件、有 `eventType`,且值是 `ChatEventType.NEW` 或 `DELETE`;不符合的訊息直接略過。
- 錯誤佇列改用 `parseErrorBody`,與 HTTP 相同支援 `{message}` 與 `{欄位: 訊息}` 兩種格式,解析不出來就顯示「聊天室發生錯誤」。

## 5. 連線狀態重複通知、斷線時送出訊息會丟例外

### 原本

- `onDisconnect` 與 `onWebSocketClose` 都呼叫 `onConnectionChange(false)`,斷線時通常兩個都會觸發,UI 收到兩次相同通知。
- `sendMessage` 直接 `client.publish(...)`,尚未連線時 stompjs 會丟例外。

### 正確

- `setConnected(value)`:值沒變就不通知,只在真正改變時呼叫 `onConnectionChange`。
- `publish()` 先檢查 `isConnected`,未連線則 `onError('尚未連線到聊天室,請稍後再試')`,不送出。
- `disconnect()` 先把 `isStopped` 設為 `true` 再 `deactivate()`,使用者自己離開時不會再跳出錯誤訊息。

## 6. 讓 socket 可以測試

`options` 可注入:

| 選項           | 用途                                     |
| -------------- | ---------------------------------------- |
| `brokerURL`    | 換掉 WebSocket 位址                      |
| `tokenManager` | 換成假的 token 管理器,控制回傳的 token   |
| `createClient` | 換成假的 STOMP client,觸發 callback 驗證 |

這就是「依賴注入」:把會碰外部世界的東西(網路、時間、儲存)從參數傳進來,測試才能控制。

## 重點整理

| 情境               | 原本                    | 現在                                    |
| ------------------ | ----------------------- | --------------------------------------- |
| 刷新 token         | 自己寫一份              | 共用 `tokenManager`(single-flight)      |
| token 壞掉         | 連線流程無聲停住        | 停止並提示登入失效                      |
| 連線被拒           | 用同一個 token 無限重連 | 刷新一次重連,仍被拒就停止並通知登入失效 |
| 收到格式錯誤的訊息 | 例外                    | 略過                                    |
| 重複的連線狀態通知 | 重複                    | 只在改變時通知                          |
| 未連線時發送       | stompjs 例外            | 提示錯誤                                |
