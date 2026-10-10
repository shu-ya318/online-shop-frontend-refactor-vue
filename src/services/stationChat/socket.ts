import { Client, type IMessage } from '@stomp/stompjs'
import { jwtDecode } from 'jwt-decode'

import { tokenManager } from '@/services/http'

import { refreshTokens } from '@/services/auth'

import type { SendMessagePayload, StationChatEvent } from './interface'

const WS_URL = `${window.location.origin.replace(/^http/, 'ws')}/ws`
const TOPIC_PREFIX = '/topic/station-chat/'
const APP_PREFIX = '/app/station-chat/'

interface StationChatSocketHandlers {
  onEvent: (event: StationChatEvent) => void
  onError?: (message: string) => void
  onConnectionChange?: (isConnected: boolean) => void
}

export interface StationChatSocket {
  sendMessage: (payload: SendMessagePayload) => void
  deleteMessage: (messageId: number) => void
  disconnect: () => void
}

/**
 * 建立指定車站的 STOMP WebSocket 連線，訂閱該站的即時聊天事件。
 * 切換車站或元件卸載時，呼叫回傳物件的 disconnect()，避免重複訂閱。
 */
export const connectStationChatSocket = (
  stationId: number,
  { onEvent, onError, onConnectionChange }: StationChatSocketHandlers,
): StationChatSocket => {
  const client = new Client({
    brokerURL: WS_URL,
    reconnectDelay: 5000,
    beforeConnect: async () => {
      // STOMP CONNECT 由後端驗證 Authorization header，若 token 已過期需先刷新，
      // 否則長時間停留在聊天室、或重連時會帶著過期 token 導致連線被拒
      let accessToken = tokenManager.getAccessToken()

      if (accessToken) {
        const { exp } = jwtDecode(accessToken)
        const isExpired = !!exp && exp * 1000 < Date.now()

        if (isExpired) {
          try {
            const response = await refreshTokens()
            tokenManager.setAccessToken(response.accessToken)
            accessToken = response.accessToken
          } catch (error) {
            console.error('[StationChatSocket] Refresh failed', error)
            tokenManager.clearAuth()
            accessToken = null
          }
        }
      }

      client.connectHeaders = accessToken ? { Authorization: `Bearer ${accessToken}` } : {}
    },
    onConnect: () => {
      client.subscribe(`${TOPIC_PREFIX}${stationId}`, (message: IMessage) => {
        const event = JSON.parse(message.body) as StationChatEvent
        onEvent(event)
      })

      client.subscribe('/user/queue/errors', (message: IMessage) => {
        const body = JSON.parse(message.body) as Record<string, string>
        const errorMessage = body.message ?? Object.values(body).join('、')
        onError?.(errorMessage)
      })

      onConnectionChange?.(true)
    },
    onDisconnect: () => {
      onConnectionChange?.(false)
    },
    onWebSocketClose: () => {
      onConnectionChange?.(false)
    },
    onStompError: (frame) => {
      onError?.(frame.headers.message || 'WebSocket 連線發生錯誤')
    },
  })

  client.activate()

  return {
    sendMessage: (payload) => {
      client.publish({
        destination: `${APP_PREFIX}${stationId}/send-message`,
        body: JSON.stringify(payload),
      })
    },
    deleteMessage: (messageId) => {
      client.publish({
        destination: `${APP_PREFIX}${stationId}/delete-message/${messageId}`,
      })
    },
    disconnect: () => {
      void client.deactivate()
    },
  }
}
