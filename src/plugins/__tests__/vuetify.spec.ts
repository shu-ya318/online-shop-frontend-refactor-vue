import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

import { BREAKPOINTS, vuetifyOptions } from '@/plugins/vuetify'

/**
 * 斷點寫在兩個地方：plugins/vuetify.ts（useDisplay 用）與 styles/settings.scss（d-md-none 等 CSS class 用）。
 * 兩邊不一致時，會出現「JS 判斷是桌面、CSS 卻顯示手機版」這種很難查的問題，這個測試負責提醒。
 */
describe('Vuetify 設定', () => {
  it('display.thresholds 與 settings.scss 的 $grid-breakpoints 一致', () => {
    // vitest.config.ts 的 root 是專案根目錄
    const scss = readFileSync(resolve(process.cwd(), 'src/styles/settings.scss'), 'utf-8')
    const block = scss.match(/\$grid-breakpoints:\s*\(([\s\S]*?)\)/)?.[1] ?? ''
    const fromScss = Object.fromEntries(
      [...block.matchAll(/'(\w+)':\s*(\d+)(?:px)?/g)].map(([, name, value]) => [
        name,
        Number(value),
      ]),
    )
    expect(fromScss).toEqual(BREAKPOINTS)
    expect(vuetifyOptions.display.thresholds).toBe(BREAKPOINTS)
  })
})
