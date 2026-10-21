// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  isPlainTextChatContent,
  isValidBirthDate,
  isValidBirthDateRange,
  isValidCellphone,
  isValidDateFormat,
} from '@/utils/validation'

/** 固定「今天」為 2024-06-15（本地時間，時區為 Asia/Taipei） */
beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date(2024, 5, 15, 12, 0, 0))
})

afterEach(() => {
  vi.useRealTimers()
})

describe('isValidDateFormat', () => {
  it('空字串視為通過', () => {
    expect(isValidDateFormat('')).toBe(true)
  })

  it.each(['2024-01-01', '2024-12-31', '2024-02-29'])('合法日期 %s 通過', (value) => {
    expect(isValidDateFormat(value)).toBe(true)
  })

  it.each([
    ['非閏年的 2/29', '2023-02-29'],
    ['不存在的 2/30', '2023-02-30'],
    ['4 月沒有 31 日', '2024-04-31'],
    ['月份 13', '2024-13-01'],
    ['月份 00', '2024-00-10'],
    ['日期 00', '2024-01-00'],
  ])('日期不存在（%s）不通過', (_label, value) => {
    expect(isValidDateFormat(value)).toBe(false)
  })

  it.each([
    ['月日未補零', '2024-1-1'],
    ['沒有分隔符號', '20240101'],
    ['斜線分隔', '2024/01/01'],
    ['前後有空白', ' 2024-01-01 '],
    ['含時間', '2024-01-01T00:00:00'],
    ['非日期文字', 'abc'],
  ])('格式不符（%s）不通過', (_label, value) => {
    expect(isValidDateFormat(value)).toBe(false)
  })
})

describe('isValidCellphone', () => {
  it.each(['0912345678', '0900000000', '0999999999'])('09 開頭 10 碼 %s 通過', (value) => {
    expect(isValidCellphone(value)).toBe(true)
  })

  it.each([
    ['空字串', ''],
    ['非 09 開頭（市話）', '0212345678'],
    ['08 開頭', '0812345678'],
    ['9 碼', '091234567'],
    ['11 碼', '09123456789'],
    ['含連字號', '0912-345-678'],
    ['含英文字母', '09123456ab'],
    ['前面有空白', ' 0912345678'],
    ['結尾有換行', '0912345678\n'],
    ['國碼格式', '+886912345678'],
  ])('%s 不通過', (_label, value) => {
    expect(isValidCellphone(value)).toBe(false)
  })
})

describe('isValidBirthDate', () => {
  it('空字串視為通過', () => {
    expect(isValidBirthDate('')).toBe(true)
  })

  it('今天通過（邊界）', () => {
    expect(isValidBirthDate('2024-06-15')).toBe(true)
  })

  it('昨天通過', () => {
    expect(isValidBirthDate('2024-06-14')).toBe(true)
  })

  it('明天不通過（邊界）', () => {
    expect(isValidBirthDate('2024-06-16')).toBe(false)
  })

  it('遙遠的過去通過（此函式不檢查年齡下限）', () => {
    expect(isValidBirthDate('1800-01-01')).toBe(true)
  })

  it.each(['2023-02-30', '2024-1-1', 'abc'])('格式錯誤或日期不存在（%s）不通過', (value) => {
    expect(isValidBirthDate(value)).toBe(false)
  })
})

describe('isPlainTextChatContent', () => {
  it.each([
    ['空字串', ''],
    ['一般英文', 'hello world'],
    ['中文與標點', '你好,今天捷運很擠!'],
    ['比較符號', 'a < b && c > d'],
    ['安全的 HTML 標籤', '<b>bold</b>'],
    ['標籤名稱只是前綴（imgx）', '<imgx>'],
    ['提到 data 但不是 data URI', 'data: image'],
  ])('純文字（%s）通過', (_label, value) => {
    expect(isPlainTextChatContent(value)).toBe(true)
  })

  it.each([
    ['png', 'data:image/png;base64,iVBORw0KGgo='],
    ['svg+xml（類型含 +）', 'data:image/svg+xml;base64,PHN2Zz4='],
    ['非圖片類型也擋', 'data:text/plain;base64,aGVsbG8='],
    ['大小寫不拘', 'DATA:IMAGE/PNG;BASE64,AAAA'],
    ['夾在文字中間', '看這個 data:image/jpeg;base64,/9j/4AAQ 圖片'],
  ])('夾帶 data URI（%s）不通過', (_label, value) => {
    expect(isPlainTextChatContent(value)).toBe(false)
  })

  it('連續 199 個 base64 字元通過（邊界）', () => {
    expect(isPlainTextChatContent('A'.repeat(199))).toBe(true)
  })

  it('連續 200 個 base64 字元不通過（邊界）', () => {
    expect(isPlainTextChatContent('A'.repeat(200))).toBe(false)
  })

  it('含 + / = 的 200 字元 base64 不通過', () => {
    expect(isPlainTextChatContent('aB+/'.repeat(50))).toBe(false)
  })

  it('被空白切斷、各自不到 200 字元通過', () => {
    expect(isPlainTextChatContent(`${'A'.repeat(150)} ${'A'.repeat(150)}`)).toBe(true)
  })

  it.each(['img', 'script', 'iframe', 'svg', 'object', 'embed'])('<%s> 標籤不通過', (tag) => {
    expect(isPlainTextChatContent(`<${tag} src="x">`)).toBe(false)
  })

  it('標籤大小寫不拘', () => {
    expect(isPlainTextChatContent('<SCRIPT>alert(1)</SCRIPT>')).toBe(false)
  })

  it('尖括號後有空白也擋', () => {
    expect(isPlainTextChatContent('< img src=x>')).toBe(false)
  })

  it('標籤夾在一般文字中間不通過', () => {
    expect(isPlainTextChatContent('你好 <img src=x onerror=alert(1)> 再見')).toBe(false)
  })
})

describe('isValidBirthDateRange（今天為 2024-06-15，合法範圍 1874-06-15 ~ 2018-06-15）', () => {
  it('空字串視為通過', () => {
    expect(isValidBirthDateRange('')).toBe(true)
  })

  it('剛滿 6 歲（2018-06-15）通過（邊界）', () => {
    expect(isValidBirthDateRange('2018-06-15')).toBe(true)
  })

  it('差一天滿 6 歲（2018-06-16）不通過（邊界）', () => {
    expect(isValidBirthDateRange('2018-06-16')).toBe(false)
  })

  it('剛滿 150 歲（1874-06-15）通過（邊界）', () => {
    expect(isValidBirthDateRange('1874-06-15')).toBe(true)
  })

  it('超過 150 歲一天（1874-06-14）不通過（邊界）', () => {
    expect(isValidBirthDateRange('1874-06-14')).toBe(false)
  })

  it('一般成人通過', () => {
    expect(isValidBirthDateRange('1990-05-20')).toBe(true)
  })

  it('今天與未來日期不通過', () => {
    expect(isValidBirthDateRange('2024-06-15')).toBe(false)
    expect(isValidBirthDateRange('2030-01-01')).toBe(false)
  })

  it.each(['2023-02-30', '2024-1-1', 'abc'])('格式錯誤或日期不存在（%s）不通過', (value) => {
    expect(isValidBirthDateRange(value)).toBe(false)
  })
})
