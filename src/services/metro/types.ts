import type { StationDetail } from './interface'

/*
處理有固定值的屬性資料時，使用 const 搭配 type 來取代傳統 enum 寫法:
1. 宣告一個加上 as const 的常數物件，唯讀性質
2. 用 typeof 與 keyof ，從常數物件取得所有值，宣告成聯合型別
*/

/*
OPTIONS: 定義一個陣列，集中定義對照表
value：對應後端 API 的參數值 (ENUM)
key: 對應後端 API 的欄位名稱 (為了用 data[key] 動態讀取物件屬性寫法，省去 if-else 判斷)
label：對應前端畫面的顯示文字
*/

export const FareType = {
  FULL: 1,
  STUDENT: 4,
  CHILD: 5,
  LOVE: 7,
} as const
export type FareType = (typeof FareType)[keyof typeof FareType]

export const RoutingStrategy = {
  MIN_TRANSFER: 1,
  MIN_TIME: 2,
} as const
export type RoutingStrategy = (typeof RoutingStrategy)[keyof typeof RoutingStrategy]

export const FARE_TYPE_OPTIONS = [
  { value: FareType.FULL, label: '全票' },
  { value: FareType.STUDENT, label: '學生票' },
  { value: FareType.CHILD, label: '兒童票' },
  { value: FareType.LOVE, label: '愛心票' },
] as const

export const FARE_TYPE_LABELS = Object.fromEntries(
  FARE_TYPE_OPTIONS.map(({ value, label }) => [value, label]),
)

export const ROUTING_STRATEGY_OPTIONS = [
  { value: RoutingStrategy.MIN_TRANSFER, label: '最少轉乘次數' },
  { value: RoutingStrategy.MIN_TIME, label: '最短車程時間' },
] as const

export const ROUTING_STRATEGY_LABELS = Object.fromEntries(
  ROUTING_STRATEGY_OPTIONS.map(({ value, label }) => [value, label]),
)

export const StationFacility = {
  ELEVATOR: 'ELEVATOR',
  ESCALATOR: 'ESCALATOR',
  ATM: 'ATM',
  RESTROOM: 'RESTROOM',
  DRINKING_WATER: 'DRINKING_WATER',
  CHARGING_STATION: 'CHARGING_STATION',
  TICKET_MACHINE: 'TICKET_MACHINE',
  NURSING_ROOM: 'NURSING_ROOM',
  DIAPER_TABLE: 'DIAPER_TABLE',
} as const
export type StationFacility = (typeof StationFacility)[keyof typeof StationFacility]

export type FacilityDetailKey = Extract<
  keyof StationDetail,
  | 'atm'
  | 'nursingRoom'
  | 'diaperTable'
  | 'chargingStation'
  | 'ticketMachine'
  | 'drinkingWater'
  | 'restroom'
  | 'elevator'
  | 'escalator'
>

// value 為後端篩選用代碼，key 為 Station/StationDetail 的欄位名稱
export const STATION_FACILITY_OPTIONS: {
  value: StationFacility
  key: FacilityDetailKey
  label: string
}[] = [
  { value: StationFacility.ELEVATOR, key: 'elevator', label: '電梯' },
  { value: StationFacility.ESCALATOR, key: 'escalator', label: '電扶梯' },
  { value: StationFacility.ATM, key: 'atm', label: 'ATM' },
  { value: StationFacility.RESTROOM, key: 'restroom', label: '廁所' },
  { value: StationFacility.DRINKING_WATER, key: 'drinkingWater', label: '飲水機' },
  { value: StationFacility.CHARGING_STATION, key: 'chargingStation', label: '充電站' },
  { value: StationFacility.TICKET_MACHINE, key: 'ticketMachine', label: '售票機' },
  { value: StationFacility.NURSING_ROOM, key: 'nursingRoom', label: '哺乳室' },
  { value: StationFacility.DIAPER_TABLE, key: 'diaperTable', label: '尿布台' },
]

export const FACILITY_DETAIL_LABELS: { key: FacilityDetailKey; label: string }[] =
  STATION_FACILITY_OPTIONS.map(({ key, label }) => ({ key, label }))
