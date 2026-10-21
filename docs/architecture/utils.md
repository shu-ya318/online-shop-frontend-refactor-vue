# 工具函式(src/utils)之說明與修正

`utils/` 放「純函式」:相同輸入一定得到相同輸出,不碰網路、DOM、全域狀態(唯一例外是用到「今天」的驗證)。這些函式從 React 版搬來,搬的時候修正了原本的邏輯錯誤。純函式最容易測試,是學寫測試的好起點。

相關文件:測試寫法見 [testing.md](../testing/testing.md)。

## date.ts:後端時間轉台北時間

### 原本(React 版 dayjs)

- 後端回傳的時間像 `2024-05-01T10:00:00`,**沒有時區標示,但實際是 UTC**。dayjs 把它當成使用者的本地時間,顯示的時間差了 8 小時(台灣)。
- 時間無效時 dayjs 回傳 `Invalid Date`,顯示出 "Invalid Date" 字樣。
- `UserPermissionPage` 寫 `formatDateTime(value) ?? '-'`:但函式沒值時回傳 `''`(空字串),`''` 不是 `null`,所以 `??` 永遠不會落到 `'-'`。

### 正確

| 函式                               | 邏輯                                                                                                          |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `parseServerDateTime`              | 空值回 `null`。字串尾端沒有 `Z` 或 `±hh:mm` 時補上 `Z` 當 UTC,再 `parseISO`;無效日期回 `null`                 |
| `formatDateTime(v, fallback = '')` | 轉成 `Asia/Taipei` 時區,格式 `yyyy-MM-dd HH:mm`;失敗回傳 `fallback`。想顯示 `-` 要寫 `formatDateTime(v, '-')` |

重點:`HAS_ZONE_PATTERN` 先判斷是否已有時區,避免對 `...Z` 的字串再補一個 `Z`。

## validation.ts:表單驗證

共同基礎 `parseStrictDate(value)`:

- 先用正規式 `^\d{4}-\d{2}-\d{2}$` 擋掉格式不對的。
- 再用 date-fns `parse` + `isValid`,**不存在的日期(`2023-02-30`)回傳 `null`**。

| 函式                     | 邏輯與原本的錯誤                                                                                           |
| ------------------------ | ---------------------------------------------------------------------------------------------------------- |
| `isValidDateFormat`      | 空值通過(必填由表單決定);其餘必須是真實存在的日期                                                          |
| `isValidCellphone`       | `^09\d{8}$`。**刻意比後端嚴格**:後端註冊只檢查 `^0\d{9}$`(市話也過),前端限定手機                           |
| `isValidBirthDate`       | 日期存在且不晚於今天(`startOfDay(new Date())`)                                                             |
| `isValidBirthDateRange`  | 年齡介於 6~150 歲。**原 dayjs 版:`Invalid Date` 的比較結果被誤判為通過**;現在格式錯誤一律回 `false`        |
| `isPlainTextChatContent` | 擋三種夾帶內容:`data:image/...;base64,`、連續 200 字元以上的 base64、`<img/script/iframe/svg/object/embed` |

### 已知的前後端落差(不是 bug,但要知道)

`isValidBirthDateRange` 用「瀏覽器本地的今天」,後端用「UTC 的今天」。台灣時間 00:00~08:00 UTC 還是前一天,剛好滿 6 歲的生日前端會通過、後端會擋下(回 400 驗證 map,由 `fieldErrors` 顯示)。

## route.ts:捷運路線的分鐘數

### 原本想解決的問題

每個區段各自「無條件進位」,加總會和總車程時間不一致:

```text
區段:61 秒、61 秒;總車程 122 秒
各自進位:2 + 2 = 4 分鐘
總時間標籤:ceil(122 / 60) = 3 分鐘     ← 4 ≠ 3,畫面上加總對不起來
```

### 正確:最大餘數法(`allocateMinutes`)

1. 目標分鐘數 = `ceil(totalSeconds / 60)`。
2. 每段先取「無條件捨去」的分鐘數(`floor`)。
3. 差額 `remainder = 目標 - 捨去後加總`。
4. 小數部分最大的前 `remainder` 段各 +1 分鐘。

上例:原始 1.0167 與 1.0167 → 捨去 1+1=2 → 差額 1 → 小數相同取第一段 +1 → `[2, 1]`,加總 3 ✓。

| 函式                     | 說明                                                                                                                        |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------- |
| `formatTravelTime`       | `ceil(秒 / 60)` + 「分鐘」,與北捷官方算法一致                                                                               |
| `allocateMinutes`        | 如上                                                                                                                        |
| `buildRouteChunkMinutes` | 把「區段、轉乘、區段、轉乘…」交錯排列(偶數索引為區段、奇數索引為轉乘),轉乘總秒數平均分給每個轉乘點,再呼叫 `allocateMinutes` |

注意:此演算法假設 `totalSeconds` 不小於各區段秒數加總。若不成立(差額超過區段數),結果不保證加總相等。

## station.ts、小工具

- `formatStationLabel(station)`:`${nameZhTw}（${stationCode}）`,例如「台北車站（BL12）」。
- `normalizeHexColor(raw)`:沒有 `#` 前綴就補上。後端的路線色碼不一定有 `#`,直接放進 CSS 會失效。

## 設計重點

- 日期函式不直接 `new Date()` 比較字串,而是統一經過 `parseServerDateTime`,只有這一個地方決定「後端時間是 UTC」。
- 測試設定固定 `TZ=Asia/Taipei`(`vitest.config.ts`),否則 `isValidBirthDate` 這類依賴「今天」的函式,在不同時區的機器上結果會不同。
