/// <reference types="vite/client" />

// 前端可讀的環境變數（建置時寫死進 bundle），範本見 env/.env.example
interface ImportMetaEnv {
  /** API 前綴，預設 /api/v1（開發走 Vite proxy、正式走 nginx 反代，與後端同源） */
  readonly VITE_API_BASE_URL?: string
  /** STOMP WebSocket 位址，留空時依目前網址推算 ws(s)://<host>/ws */
  readonly VITE_WS_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
