export const ChatType = {
  TEXT: 'TEXT',
  TRIP_PLAN: 'TRIP_PLAN',
} as const
export type ChatType = (typeof ChatType)[keyof typeof ChatType]

export const ChatEventType = {
  NEW: 'NEW',
  DELETE: 'DELETE',
} as const
export type ChatEventType = (typeof ChatEventType)[keyof typeof ChatEventType]
