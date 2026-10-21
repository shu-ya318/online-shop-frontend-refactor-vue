import type { LocationQueryValue } from 'vue-router'
/** 只用來判斷「是不是同一個網站」的假網址，不會真的連線 */
const BASE = 'http://lookgo.invalid'

/** 是否含 ASCII 控制字元（0x00–0x1F、0x7F） */
const hasControlCharacter = (value: string): boolean =>
  [...value].some((char) => {
    const code = char.charCodeAt(0)
    return code < 0x20 || code === 0x7f
  })
/**
 * 從 ?redirect= 取出可以安全導過去的站內路徑；不安全或沒有就回傳 null（呼叫端改用預設頁）。
 *
（略過第 15 行的註解）
 * 但 redirect 是網址參數，任何人都能造一個連結，所以只接受站內路徑，避免「開放式重新導向」
 * （例如 /auth/login?redirect=https://釣魚網站，登入後被帶走）。
 *
 * 規則：
 * - 必須是字串，以單一個 / 開頭（擋掉 https://、//evil.com 這種協定相對網址）
 * - 不能有控制字元（瀏覽器解析網址時會刪掉 tab、換行，'/\t/evil.com' 會變成 '//evil.com'）
 * - 用 URL 解析後 origin 必須不變（'/\evil.com' 在瀏覽器會被當成 '//evil.com'，這一步擋掉）
 * - 不能是 /auth 底下的頁面（登入完又導回登入頁）
 *
 * @param value `route.query.redirect`，可能是字串、陣列（取第一個）或 undefined
 * @returns 正規化後的 `pathname + search + hash`；不安全或不存在時回傳 null
 */
export const getSafeRedirect = (
  value: LocationQueryValue | LocationQueryValue[] | undefined,
): string | null => {
  const raw = Array.isArray(value) ? value[0] : value
  if (typeof raw !== 'string' || !raw.startsWith('/') || raw.startsWith('//')) {
    return null
  }
  if (hasControlCharacter(raw)) {
    return null
  }
  let url: URL
  try {
    url = new URL(raw, BASE)
  } catch {
    return null
  }
  if (url.origin !== BASE) {
    return null
  }
  if (url.pathname === '/auth' || url.pathname.startsWith('/auth/')) {
    return null
  }
  return `${url.pathname}${url.search}${url.hash}`
}
