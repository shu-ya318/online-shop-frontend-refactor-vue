import { Client, type IFrame, type IMessage, type StompConfig } from '@stomp/stompjs'

import { parseErrorBody } from '@/services/errors'
import { tokenManager as sharedTokenManager } from '@/services/http'

import { ChatEventType } from './types'

import type { TokenManager } from '@/services/tokenManager'
import type { SendMessagePayload, StationChatEvent } from './interface'

const TOPIC_PREFIX = '/topic/station-chat/'
const APP_PREFIX = '/app/station-chat/'
const ERROR_QUEUE = '/user/queue/errors'
const RECONNECT_DELAY_MS = 5000

interface StationChatSocketHandlers {
  onEvent: (event: StationChatEvent) => void
  onError?: (message: string) => void
  onConnectionChange?: (isConnected: boolean) => void
}

interface StationChatSocketOptions {
  /** 測試用：覆寫 WebSocket 位址 */
  brokerURL?: string
  /** 測試用：覆寫 token 管理器 */
  tokenManager?: TokenManager
  /** 測試用：覆寫 STOMP client 的建立 */
  createClient?: (config: StompConfig) => Client
}

export interface StationChatSocket {
  sendMessage: (payload: SendMessagePayload) => void
  deleteMessage: (messageId: number) => void
  disconnect: () => void
}

/**
 * WebSocket 位址。React 版在模組載入時就算 window.location 算好（測試環境會出問題），
 * 改成呼叫時才算，並允許用 VITE_WS_URL 覆寫。後端沒開 SockJS，用原生 WebSocket。
 */
export const resolveBrokerUrl = (): string =>
  import.meta.env.VITE_WS_URL || `${window.location.origin.replace(/^http/, 'ws')}/ws`

const parseJson = (text: string): unknown => {
  try {
    return JSON.parse(text)
  } catch {
    return undefined
  }
}

const isStationChatEvent = (value: unknown): value is StationChatEvent =>
  typeof value === 'object' &&
  value !== null &&
  'eventType' in value &&
  (value.eventType === ChatEventType.NEW || value.eventType === ChatEventType.DELETE)

/**
 * 建立指定車站的 STOMP WebSocket 連線，訂閱該站的即時聊天事件。
 * 切換車站或元件卸載時，呼叫回傳物件的 disconnect()，避免重複訂閱。
 */
export const connectStationChatSocket = (
  stationId: number,
  { onEvent, onError, onConnectionChange }: StationChatSocketHandlers,
  options: StationChatSocketOptions = {},
): StationChatSocket => {
  const tokens = options.tokenManager ?? sharedTokenManager
  const createClient = options.createClient ?? ((config: StompConfig) => new Client(config))

  let isConnected = false
  let isStopped = false
  /** 這次 CONNECT 帶出去的 token，被拒時用來判斷要不要刷新 */
  let sentToken: string | null = null
  /** 每次成功連線前，只允許「被拒 → 刷新 → 重連」一次 */
  let hasRetriedAuth = false

  const setConnected = (value: boolean) => {
    if (isConnected === value) {
      return
    }

    isConnected = value
    onConnectionChange?.(value)
  }

  /** 停止連線，而且不再自動重連 */
  const stop = (message: string) => {
    if (isStopped) {
      return
    }

    isStopped = true
    void client.deactivate()
    setConnected(false)
    onError?.(message)
  }

  /**
   * 後端只在 STOMP CONNECT 時驗證 token（StompAuthChannelInterceptor），
   * 所以「還沒連上就收到 ERROR frame」一定是 token 被拒。
   */
  const handleConnectRejected = (message: string) => {
    if (!hasRetriedAuth && sentToken) {
      hasRetriedAuth = true

      // 和 HTTP 的 401 一樣先強制刷新一次。後端送出 ERROR 後會關閉連線，
      // reconnectDelay 後重連，beforeConnect 會拿到刷新後的 token
      void tokens.refreshAfterUnauthorized(sentToken).then(
        (token) => {
          if (!token) {
            stop('登入已失效，請重新登入後再使用聊天室')
          }
        },
        () => stop('登入已失效，請重新登入後再使用聊天室'),
      )
      return
    }

    // 刷新過仍被拒：停止重連，並判定登入失效（清 token、通知 onAuthExpired）
    stop(message)
    tokens.expireSession()
  }

  const client: Client = createClient({
    brokerURL: options.brokerURL ?? resolveBrokerUrl(),
    reconnectDelay: RECONNECT_DELAY_MS,
    beforeConnect: async () => {
      // stompjs 會 await 這個函式；這裡丟出例外會讓連線流程停住、也不會重連，
      // 所以所有錯誤都在這裡處理掉
      let token: string | null = null
      try {
        token = await tokens.getValidAccessToken()
      } catch {
        token = null
      }

      if (!token) {
        // 不帶 token 連線一定被後端拒絕，直接停止。
        // 還有 token 代表是刷新時網路出錯，登入可能還有效；沒有 token 才是真的登入失效
        stop(
          tokens.getAccessToken()
            ? '暫時無法連線到聊天室，請稍後重新整理頁面'
            : '登入已失效，請重新登入後再使用聊天室',
        )
        return
      }

      sentToken = token
      client.connectHeaders = { Authorization: `Bearer ${token}` }
    },
    onConnect: () => {
      hasRetriedAuth = false

      // 寫在 onConnect 裡，重連後會自動重新訂閱
      client.subscribe(`${TOPIC_PREFIX}${stationId}`, (message: IMessage) => {
        const event = parseJson(message.body)
        if (isStationChatEvent(event)) {
          onEvent(event)
        }
        // 格式不對的訊息直接略過，不讓例外打斷 stompjs 的訊息處理
      })

      client.subscribe(ERROR_QUEUE, (message: IMessage) => {
        // 與 HTTP 相同的兩種格式：{message} 或 {欄位: 訊息}
        const { message: errorMessage } = parseErrorBody(message.body)
        onError?.(errorMessage ?? '聊天室發生錯誤')
      })

      setConnected(true)
    },
    onDisconnect: () => {
      setConnected(false)
    },
    onWebSocketClose: () => {
      setConnected(false)
    },
    onStompError: (frame: IFrame) => {
      const message = frame.headers.message || 'WebSocket 連線發生錯誤'
      if (!isConnected) {
        handleConnectRejected(message)
        return
      }
      onError?.(message)
    },
  })

  client.activate()

  const publish = (destination: string, body?: string) => {
    if (!isConnected) {
      onError?.('尚未連線到聊天室，請稍後再試')
      return
    }

    client.publish({ destination, body })
  }

  return {
    sendMessage: (payload) =>
      publish(`${APP_PREFIX}${stationId}/send-message`, JSON.stringify(payload)),
    deleteMessage: (messageId) => publish(`${APP_PREFIX}${stationId}/delete-message/${messageId}`),
    disconnect: () => {
      isStopped = true
      void client.deactivate()
    },
  }
}
