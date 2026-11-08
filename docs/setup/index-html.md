# index.html

- 作為 Vite 專案的入口點（Entry Point）。
- **與 Webpack 專案比較 **：
  - 真正入口點為 JavaScript (main.js)
  - HTML 路徑位於 public/ 內
  - 由打包工具將 JS 載入 HTML
  - 開發載入速度 慢（需要先打包完所有 JS）

- 本文依檔案由上到下分為「文件語言與編碼」、「分頁圖示」、「viewport」、「標題」、「執行期設定 script」、「掛載點與入口 script」六個區域。

## 文件語言與編碼

### 設定語法對應效果

| 設定                       | 效果                                                                |
| -------------------------- | ------------------------------------------------------------------- |
| `<html lang="zh-Hant">`    | 宣告頁面為繁體中文,影響螢幕閱讀器發音、瀏覽器翻譯提示與中文字型選擇 |
| `<html lang="zh-Hant-TW">` | 同上,另外標明地區為台灣                                             |
| `<meta charset="UTF-8" />` | 以 UTF-8 解析頁面,中文不會變亂碼                                    |

### 應避免的錯誤

- `lang="en"`,但網站內容全是繁體中文
  - 沿用 Vite 預設範本的值,沒有改成實際語言。
  - 後果
    - 螢幕閱讀器會用英文語音唸中文;瀏覽器會跳出「要翻譯這個網頁嗎?」;部分字型會選錯中文字形。
  - Vue 版做法
    - 本專案用 `lang="zh-Hant"`;範本的 `zh-Hant-TW` 也是合法寫法,擇一即可。

## 分頁圖示

### 設定語法對應效果

| 設定                                                           | 效果                                            |
| -------------------------------------------------------------- | ----------------------------------------------- |
| `<link rel="icon" type="image/svg+xml" href="/favicon.svg" />` | 以 SVG 當分頁圖示;`/` 開頭代表從 `public/` 取檔 |
| `<link rel="icon" href="/favicon.ico" />`                      | 以 `.ico` 當分頁圖示,`.ico` 不需寫 `type`       |

### 應避免的錯誤

- `href` 指向的圖示檔不存在
  - 寫 `href="/favicon.svg"`,但 `public/` 內只有 `favicon.ico`。
  - 後果
    - 瀏覽器請求 `/favicon.svg` 拿不到圖示,分頁顯示預設空白圖示。
  - Vue 版做法
    - 讓 `href` 與 `public/` 內的檔名一致,二擇一:
      - 改用範本寫法 `<link rel="icon" href="/favicon.ico" />`。
      - 或把 lookGo 的 logo 以 `favicon.svg` 放進 `public/`,保留現有寫法。

- 圖示內容仍是 Vite 或範本附的預設圖示
  - 只複製範本,沒有換成自己的 logo。
  - 後果
    - 瀏覽器分頁上顯示的是 Vite 的閃電圖示或範本圖示,而不是 lookGo。
  - Vue 版做法
    - 換成 lookGo 的 logo 檔。

## viewport

### 設定語法對應效果

| 設定                                                                       | 效果                                        |
| -------------------------------------------------------------------------- | ------------------------------------------- |
| `<meta name="viewport" content="width=device-width, initial-scale=1.0" />` | 行動裝置以裝置實際寬度渲染,RWD 版面才會生效 |

### 應避免的錯誤

- 缺少 viewport meta
  - 沒有這行,手機瀏覽器會以約 980px 的桌面寬度渲染再縮小。
  - 後果
    - 手機上字體過小、`@media` 斷點與 Vuetify 的響應式斷點不會如預期觸發。
  - Vue 版做法
    - 保留這一行。

## 標題

### 設定語法對應效果

| 設定                        | 效果                           |
| --------------------------- | ------------------------------ |
| `<title>如：lookGo</title>` | 分頁、書籤、搜尋結果顯示的標題 |

### 應避免的錯誤

- `<title>` 沿用範本名稱
  - Vue 版做法
    - 各頁面的標題可由路由(vue-router 的 `meta.title`)動態設定。

## 執行期設定 script

### 設定語法對應效果

| 設定                                         | 效果                                                                            |
| -------------------------------------------- | ------------------------------------------------------------------------------- |
| `<script src="/runtime-config.js"></script>` | 在主程式前載入 `public/runtime-config.js`,部署時不重新 build image 也能抽換變數 |
| (可選)                                       | 可在本地開發時以 `.env.*` 來提供預設值，build 時值固定(見 `env.d.ts`)           |

### 應避免的錯誤

- `runtime-config.js` 放在 `main.ts` 之後載入
  - 範本的取值順序是 `runtime-config.js`(`window.__VUETEMPLATE_CONFIG__`)→ `VITE_*` → 程式內預設值。
  - 後果
    - 主程式執行時 `window` 上還沒有設定,永遠讀到 `VITE_*` 或預設值,抽換檔案沒有效果。
  - Vue 版做法
    - 採用時把這行放在 `<head>`,早於 `<script type="module" src="/src/main.ts">`。

## 掛載點與入口 script

### 設定語法對應效果

| 設定                                        | 效果                                                                 |
| ------------------------------------------- | -------------------------------------------------------------------- |
| `<div id="app"></div>`                      | Vue 的掛載點,`main.ts` 的 `app.mount('#app')` 會把應用程式渲染在這裡 |
| `<script type="module" src="/src/main.ts">` | 以 ES Module 載入應用程式入口,由 Vite 轉譯與打包                     |

### 應避免的錯誤

- 掛載點 id 與 `main.ts` 不一致
  - React 版是 `#root`,Vue 版是 `#app`;只改一邊會找不到掛載元素。
  - 後果
    - 頁面一片空白,Console 出現 `Failed to mount app: mount target selector "#app" returned null`。
  - Vue 版做法
    - `index.html` 的 `id="app"` 與 `main.ts` 的 `mount('#app')` 保持一致。

- 入口檔副檔名與實際檔案不一致
  - 原 React 版是 `main.tsx`,Vue 版是 `main.ts`。
  - 後果
    - Vite 找不到入口檔,`npm run dev` 與 `npm run build` 失敗(404 或解析錯誤)。
  - Vue 版做法
    - `src="/src/main.ts"`,與實際檔案同名同副檔名。
