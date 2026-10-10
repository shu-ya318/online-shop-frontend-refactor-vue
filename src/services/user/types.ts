/*
處理有固定值的屬性資料時，使用 const 搭配 type 來取代傳統 enum 寫法:
1. 宣告一個加上 as const 的常數物件，唯讀性質
2. 用 typeof 與 keyof ，從常數物件取得所有值，宣告成聯合型別
*/

/*
OPTIONS: 定義一個陣列，集中定義對照表
value：對應後端 API 的參數值 (ENUM)
label：對應前端畫面的顯示文字
*/

export const MembershipTier = {
  BASIC: 'BASIC',
  PREMIUM: 'PREMIUM',
} as const
export type MembershipTier = (typeof MembershipTier)[keyof typeof MembershipTier]

export const UserRole = {
  USER: 'USER',
  ADMIN: 'ADMIN',
} as const
export type UserRole = (typeof UserRole)[keyof typeof UserRole]

export const UserStatus = {
  DISABLED: 'DISABLED',
  ACTIVE: 'ACTIVE',
} as const
export type UserStatus = (typeof UserStatus)[keyof typeof UserStatus]

export const MEMBERSHIP_TIER_OPTIONS = [
  { value: MembershipTier.BASIC, label: '基本' },
  { value: MembershipTier.PREMIUM, label: '進階' },
] as const

export const MEMBERSHIP_TIER_LABELS = Object.fromEntries(
  MEMBERSHIP_TIER_OPTIONS.map(({ value, label }) => [value, label]),
)
