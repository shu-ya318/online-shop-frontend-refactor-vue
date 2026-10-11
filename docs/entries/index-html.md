# index.html

Vite 的入口 HTML(放在專案根目錄,不在 `public/`)。依檔案由上到下分為「文件語言與編碼」、「分頁圖示與標題」、「viewport」、「掛載點與入口 script」四個區域。Vue 版的掛載點為 `#app`、入口檔為 `main.ts`。

## 文件語言與編碼

### 設定語法對應效果

| 設定                       | 效果                                                                |
| -------------------------- | ------------------------------------------------------------------- |
| `<html lang="zh-Hant">`    | 宣告頁面為繁體中文,影響螢幕閱讀器發音、瀏覽器翻譯提示與中文字型選擇 |
| `<meta charset="UTF-8" />` | 以 UTF-8 解析頁面,中文不會變亂碼                                    |

### 應避免的錯誤

- 錯誤1：`lang="en"`,但網站內容全是繁體中文
  - 沿用 Vite 範本的預設值,沒有改成實際語言。
- 後果
  - 螢幕閱讀器會用英文語音唸中文;瀏覽器會跳出「要翻譯這個網頁嗎?」;部分字型會選錯中文字形。
- Vue 版做法
  - `lang="zh-Hant"`。

## 分頁圖示與標題

### 設定語法對應效果

| 設定                                                           | 效果                                             |
| -------------------------------------------------------------- | ------------------------------------------------ |
| `<link rel="icon" type="image/svg+xml" href="/favicon.svg" />` | 設定瀏覽器分頁圖示;`/` 開頭代表從 `public/` 取檔 |
| `<title>lookGo</title>`                                        | 分頁、書籤、搜尋結果顯示的標題                   |

### 應避免的錯誤

- 錯誤2：favicon 仍是 Vite 範本的預設圖示
  - `favicon.svg` 是 Vite 範本附的圖示,不是 lookGo 的 logo。
- 後果
  - 瀏覽器分頁上顯示的是 Vite 的閃電圖示。
- Vue 版做法
  - 換成 lookGo 的 logo,並確認 `href` 指向的檔案真的存在於 `public/`(目前 `public/` 內只有 `favicon.ico`,與 `href="/favicon.svg"` 不一致,需擇一調整)。

- 錯誤3：`<title>` 使用專案資料夾名稱
  - 標題寫成 `lookGo-frontend` 這類 repo 名稱。
- 後果
  - 使用者在分頁、書籤、搜尋結果看到的是「lookGo-frontend」。
- Vue 版做法
  - 改成 `lookGo`。之後各頁面的標題可由路由(vue-router 的 `meta.title`)動態設定。

## viewport

### 設定語法對應效果

| 設定                                                                       | 效果                                        |
| -------------------------------------------------------------------------- | ------------------------------------------- |
| `<meta name="viewport" content="width=device-width, initial-scale=1.0" />` | 行動裝置以裝置實際寬度渲染,RWD 版面才會生效 |

### 應避免的錯誤

- 錯誤4：缺少 viewport meta
  - 沒有這行,手機瀏覽器會以約 980px 的桌面寬度渲染再縮小。
- 後果
  - 手機上字體過小、`@media` 斷點與 Vuetify 的響應式斷點不會如預期觸發。
- Vue 版做法
  - 保留範本內建的這一行。

## 掛載點與入口 script

### 設定語法對應效果

| 設定                                        | 效果                                                                 |
| ------------------------------------------- | -------------------------------------------------------------------- |
| `<div id="app"></div>`                      | Vue 的掛載點,`main.ts` 的 `app.mount('#app')` 會把應用程式渲染在這裡 |
| `<script type="module" src="/src/main.ts">` | 以 ES Module 載入應用程式入口,由 Vite 轉譯與打包                     |

### 應避免的錯誤

- 錯誤5：掛載點 id 與 `main.ts` 不一致
  - React 版是 `#root`,Vue 版是 `#app`;只改一邊會找不到掛載元素。
- 後果
  - 頁面一片空白,Console 出現 `Failed to mount app: mount target selector "#app" returned null`。
- Vue 版做法
  - `index.html` 的 `id="app"` 與 `main.ts` 的 `mount('#app')` 保持一致。

- 錯誤6：入口檔副檔名與實際檔案不一致
  - 原 React 版是 `main.tsx`,Vue 版是 `main.ts`。
- 後果
  - Vite 找不到入口檔,`npm run dev` 與 `npm run build` 失敗(404 或解析錯誤)。
- Vue 版做法
  - `src="/src/main.ts"`,與實際檔案同名同副檔名。
