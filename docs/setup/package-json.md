# package.json(含 package-lock.json) 說明

- package.json 會列出專案要裝的套件與指令。
- 以下依 `package.json` 的區塊順序,說明各項設定的用途與指令效果。

## 前端框架語言重構時的考量

可依照以下分類檢視目前的套件：

- 1. 直接照用
- 2. 換成 Vue3 生態系的對應套件
- 3. 等用到時再安裝
- 4. 已不需要，可移除

## 1. 基本資訊

| 欄位      | 值                     | 說明                                                                               |
| --------- | ---------------------- | ---------------------------------------------------------------------------------- |
| `name`    | `lookgo-frontend-vue3` | 專案名稱。npm 規範要求全小寫,不可含空白                                            |
| `version` | `1.0.0`                | 專案版本號,採 SemVer(主版號.次版號.修訂號)                                         |
| `private` | `true`                 | 禁止被 `npm publish` 發佈到 npm registry                                           |
| `type`    | `module`               | 將 `.js` 視為 ESM(使用 `import` / `export`)。設定檔(如 `vite.config.ts`)也依此解析 |

## 2. scripts(指令腳本)

- 以 `npm run <名稱>` 執行。`test` 與 `start` 可省略 `run`,其餘都要加。

### 開發與建置

| 指令                 | 實際執行                               | 效果                                                                                                                                                                                                           |
| -------------------- | -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run dev`        | `vite`                                 | 啟動本機開發伺服器,支援 HMR(熱更新),存檔後畫面即時更新                                                                                                                                                         |
| `npm run build`      | `run-p type-check "build-only {@}" --` | `run-p`(來自 `npm-run-all2`)讓型別檢查與打包**平行**執行,任一失敗即視為 build 失敗。`{@}` 會把額外參數轉給 `build-only`,例如 `npm run build -- --mode staging`。結尾的 `--` 是分隔符號,避免參數被 `run-p` 吃掉 |
| `npm run build-only` | `vite build`                           | 只打包,不做型別檢查。產出在 `dist/`                                                                                                                                                                            |
| `npm run type-check` | `vue-tsc --build`                      | 只做 TypeScript 型別檢查(含 `.vue` 檔)。`--build` 啟用專案參考(Project References)模式,依 `tsconfig` 的關聯逐一檢查並做增量快取,不產出檔案                                                                     |
| `npm run preview`    | `vite preview`                         | 在本機預覽 `dist/` 打包結果,用來模擬正式環境。須先 build                                                                                                                                                       |

> **備註:`build` 目前寫法 vs. `vue-tsc -b && vite build`**
>
> | 比較項目   | 目前寫法 `run-p type-check "build-only {@}" --`                | 簡化寫法 `vue-tsc -b && vite build`                                      |
> | ---------- | -------------------------------------------------------------- | ------------------------------------------------------------------------ |
> | 執行方式   | 型別檢查與打包**平行**同時跑                                   | **依序**執行:先檢查,通過才打包                                           |
> | 速度       | 較快,總時間約為兩者中較慢的那個                                | 較慢,總時間為兩者相加                                                    |
> | 型別有錯時 | 打包可能已跑完或跑到一半,最後整體回報失敗                      | 檢查失敗就立刻中止,不進行打包                                            |
> | 額外參數   | `{@}` 可轉給 `vite build`,如 `npm run build -- --mode staging` | 參數接在 `vite build` 後面,但 `&&` 串接下不易控制傳給誰                  |
> | 額外套件   | 需要 `npm-run-all2`                                            | 不需要,只靠 shell 的 `&&`                                                |
> | 可單獨執行 | 有 `type-check`、`build-only` 可分開跑                         | 要自己另外寫腳本才能分開跑                                               |
> | 跨平台     | `run-p` 在 Windows、macOS、Linux 行為一致                      | `&&` 在多數 shell 都可用,但舊版 Windows cmd 與 PowerShell 5.1 行為有差異 |
>
> **適用情形:**
>
> - 重視 CI 速度、工具鏈較完整 → 用`run-p type-check "build-only {@}" --` (`create-vue` 官方預設)。
> - 重視簡單、可預期的失敗順序 → 用 `vue-tsc -b && vite build`(Vite 官方模板寫法)。

### 測試

| 指令                      | 實際執行          | 效果                                                                     |
| ------------------------- | ----------------- | ------------------------------------------------------------------------ |
| `npm run test:unit`       | `vitest run`      | 執行一次所有單元測試後結束,適合 CI                                       |
| `npm run test:unit:watch` | `vitest`          | 監聽模式,改檔後自動重跑相關測試,適合開發時使用                           |
| `npm run test:e2e`        | `playwright test` | 執行 Playwright E2E 測試。首次需執行 `npx playwright install` 下載瀏覽器 |

`vitest` 與 `vitest run` 的差異:

- `vitest`:依環境自動決定模式。本機互動式終端機(TTY)預設進入 watch 模式、不會自動結束;在 CI 或非 TTY(環境變數 `CI` 有值)則自動退化成單次執行。
- `vitest run`:一律只跑一次就結束,不看環境,結果可預期。
- 本專案刻意拆成兩支:`test:unit` 用 `vitest run`(給 CI、`lint-staged`、提交前驗證,保證不會卡住不結束),`test:unit:watch` 用 `vitest`(開發時監聽)。這與 Vitest 官方建議一致:官方範本把 `test` 設為 `vitest`,但文件也建議 CI 使用 `vitest run`。若把 `test:unit` 改成 `vitest`,在本機被其他腳本或 hook 呼叫時會停在 watch 模式,所以不建議改。

### 程式碼品質(Lint / Format)

| 指令                     | 實際執行                                    | 效果                                                                                                                                                                                                     |
| ------------------------ | ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run lint`           | `run-s "lint:*"`                            | `run-s`(來自 `npm-run-all2`)依序(serial)執行所有 `lint:` 開頭的腳本,`*` 為萬用字元,新增 `lint:xxx` 會自動納入,不必改這行                                                                                 |
| `npm run lint:oxlint`    | `oxlint . --fix`                            | 用 Oxlint 檢查整個專案。`.` 代表從專案根目錄開始掃描,`--fix` 自動修正可安全修的問題。速度快,先擋明顯問題                                                                                                 |
| `npm run lint:eslint`    | `eslint . --fix --cache`                    | 用 ESLint 檢查整個專案。`.` 代表從專案根目錄開始掃描,`--fix` 自動修正,`--cache` 只重新檢查有變動的檔案(快取存於 `.eslintcache`),重複執行時更快                                                           |
| `npm run lint:stylelint` | `stylelint "src/**/*.{css,scss,vue}" --fix` | 用 Stylelint 檢查樣式。引號內為檔案範圍(glob),`src/` 下所有 `.css`、`.scss`、`.vue`(含 `<style>` 區塊)都會檢查,`--fix` 自動修正。規則設定在 `.stylelintrc.json`;因 `lint` 會執行所有 `lint:*`,會一併跑到 |
| `npm run format`         | `prettier --write src/`                     | 把 `src/` 下的檔案依 Prettier 規則統一排版。`--write` 直接覆寫檔案(沒加則只輸出結果);`src/` 限定處理範圍,避免動到設定檔與 `node_modules`                                                                 |

> **備註:`format` 要不要加 `--experimental-cli`?**
>
> 寫法:`prettier --write --experimental-cli src/`。`--experimental-cli` 是 Prettier 的新版命令列實作,重點是提升大型專案的格式化速度。
>
> **建議:目前不用加。** 這個專案的 `src/` 規模還小,速度差異感受不到;而且仍是實驗性功能,行為與穩定版 CLI 可能有細微差異,放進團隊腳本或 CI 有風險。專案變大、`format` 明顯變慢時再評估。
>
> | 比較項目 | `prettier --write src/`(目前) | `prettier --write --experimental-cli src/`    |
> | -------- | ----------------------------- | --------------------------------------------- |
> | 穩定性   | 穩定版,正式支援               | 實驗性,選項與輸出可能變動                     |
> | 速度     | 一般                          | 較快,大型專案差異明顯                         |
> | 相容性   | 完整支援所有選項與外掛        | 部分選項、外掛可能不支援或行為不同            |
> | 適用情境 | 團隊共用、CI、`lint-staged`   | 個人本機試用,或檔案數量很多、想縮短格式化時間 |
> | 風險     | 低                            | 升級 Prettier 後行為可能改變,需自行驗證       |
>
> 若要試用,可先另開腳本(例如 `format:fast`)在本機使用,不要直接取代 `format`。

### Lint 工具比較:ESLint、Oxlint、Stylelint、Prettier

這四個工具職責不同,不是互相取代的關係。

| 工具          | 檢查對象                        | 主要職責                                                      | 能否自動修正            | 本專案角色                                                 |
| ------------- | ------------------------------- | ------------------------------------------------------------- | ----------------------- | ---------------------------------------------------------- |
| **ESLint**    | JS / TS / Vue                   | 程式品質與潛在錯誤(未使用變數、錯誤的 Vue 寫法、型別相關規則) | 部分規則可 `--fix`      | 主要 linter,規則最完整,擴充外掛最多                        |
| **Oxlint**    | JS / TS(Vue 支援有限)           | 與 ESLint 類似,但以 Rust 實作,速度快數十倍                    | 部分規則可 `--fix`      | 先行快速檢查;`eslint-plugin-oxlint` 會關掉 ESLint 重複規則 |
| **Stylelint** | CSS / SCSS / `.vue` 的 style    | 樣式品質(無效屬性、重複選擇器、命名與順序規範)                | 部分規則可 `--fix`      | 樣式專用檢查                                               |
| **Prettier**  | JS / TS / Vue / CSS / JSON / MD | 統一排版(縮排、換行、引號、分號、行寬)                        | 一律直接改寫(`--write`) | 統一程式碼風格                                             |

**核心差異**

- **Linter vs. Formatter:** ESLint、Oxlint、Stylelint 是 linter,找「寫得對不對、好不好」的問題;Prettier 是 formatter,只處理「長得整不整齊」,不判斷程式邏輯。
- **ESLint vs. Oxlint:** ESLint 規則與外掛生態最完整,但慢;Oxlint 快,但規則覆蓋較少、對 `.vue` 支援有限。兩者並用,Oxlint 先擋、ESLint 補完整規則。
- **ESLint vs. Stylelint:** 分工以語言區分,ESLint 管腳本,Stylelint 管樣式,互不重疊。
- **避免衝突:** `eslint-config-prettier` 會關掉 ESLint 中與排版有關的規則,讓排版統一交給 Prettier。

**執行順序建議:** 先 lint 修正邏輯與品質問題,最後 format 統一排版。

### Git hooks

| 指令      | 實際執行 | 效果                                                                                          |
| --------- | -------- | --------------------------------------------------------------------------------------------- |
| `prepare` | `husky`  | 執行 `npm install` 後自動觸發,安裝 Git hooks,在 commit 前可自動跑檢查，避免推版有問題的程式碼 |

## 3. dependencies(正式環境相依套件)

- 這些套件會被打包進最終的程式,是執行階段需要的。

| 套件                                                | 用途                                                                                                |
| --------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `vue`                                               | 前端框架主體(Vue 3)                                                                                 |
| `vuetify`                                           | UI 元件庫(Vuetify 3),以 SCSS 管理主題變數                                                           |
| `vue-router`                                        | 前端路由(Vue Router 4),管理頁面切換                                                                 |
| `pinia`                                             | 狀態管理(State Management),Vuex 的官方繼任者                                                        |
| `vue-i18n`                                          | 多語系(i18n)                                                                                        |
| `axios`                                             | 發送 HTTP 請求,串接後端 API                                                                         |
| `keycloak-js`                                       | Keycloak 前端 SDK,處理 SSO 單一登入                                                                 |
| `@stomp/stompjs`                                    | 以 STOMP 協定連 WebSocket,做即時通訊(如：聊天、通知)                                                |
| `jwt-decode`                                        | 解碼 JWT token,讀取登入者資訊(只解碼,不驗證簽章)                                                    |
| `@mdi/font`                                         | Material Design Icons 圖示字型,Vuetify 圖示使用(`src/plugins/vuetify.ts` 引入)                      |
| `zod`                                               | Schema 驗證,用於表單與 API 回應的資料驗證與型別推導。表單處理方式見下方備註                         |
| `date-fns`                                          | 日期處理函式庫,函式式寫法、支援 tree-shaking(取代 dayjs)                                            |
| `decimal.js`                                        | 高精度小數運算,避免浮點誤差(取代 number-precision)                                                  |
| `lodash-es`                                         | 常用工具函式(ESM 版,支援 tree-shaking,只打包用到的部分)                                             |
| `taiwan-id-validator`                               | 台灣身分證字號驗證(沿用)                                                                            |
| `@tiptap/vue-3`                                     | 富文字編輯器的 Vue 3 綁定(取代 react-quill)                                                         |
| `@tiptap/core`、`@tiptap/pm`、`@tiptap/starter-kit` | Tiptap 核心、底層編輯引擎(ProseMirror)與常用功能包。四個 Tiptap 套件版本必須一致,否則會出現相依衝突 |
| `jspdf`                                             | 前端產生 PDF(取代 @react-pdf/renderer)                                                              |

> 第三方套件可能需調整後再上傳 Nexus(公司內部套件庫)。自行調整後,Mend.io 將可能無法比對第三方套件清單來找出漏洞,新增或修改套件前需評估。

**date-fns vs. dayjs**

| 比較項目     | date-fns(採用)                                           | dayjs                                       |
| ------------ | -------------------------------------------------------- | ------------------------------------------- |
| 寫法         | 純函式,`format(date, 'yyyy-MM-dd')`,不改動原本的日期物件 | 鏈式物件,`dayjs(date).format('YYYY-MM-DD')` |
| TypeScript   | 內建完整型別,型別推導準確                                | 有型別,但外掛(plugin)需另外註冊與擴充型別   |
| 打包體積     | 支援 tree-shaking,只打包用到的函式                       | 核心很小,但用到的外掛會再增加體積           |
| 時區、多語系 | 時區需搭配 `@date-fns/tz`,語系以 import 引入             | 以外掛支援,需 `dayjs.extend()`              |
| 適合情境     | TypeScript 專案、重視型別安全與體積                      | 想沿用 Moment 風格、快速上手                |

Vue 3 + TypeScript 的新專案建議用 date-fns,也是 issue 的決議。注意 date-fns 的格式字串大小寫與 dayjs 不同(`yyyy-MM-dd` vs `YYYY-MM-DD`),搬移程式時要留意。

**表單與 zod**

- 目前專案沒有安裝任何表單套件(如 vee-validate、FormKit),只有 `zod` 與 Vuetify 內建的表單元件。
- 自行手刻表單時,**仍建議搭配 zod**:zod 負責「資料對不對」,用 `.refine` / `.superRefine` 處理跨欄位與特殊邏輯、`parseAsync` 處理非同步檢查,同一份 schema 還能推導 TypeScript 型別,並重複用於 API 回應驗證。
- 但 zod **不管表單狀態**。手刻時要自己處理欄位值、是否碰過(touched)、錯誤訊息、送出中狀態,建議包成一個共用 composable(例如 `useZodForm`),把 `safeParse` 的錯誤對應到 Vuetify 的 `error-messages`,避免每個表單各寫一套。
- 暫不建議加 `vee-validate`:它的 zod 轉接套件 `@vee-validate/zod` 要求 zod 3.x,與本專案的 zod 4.x 不相容。若日後表單複雜到維護困難,再評估支援 zod 4 的方案,並先確認相依版本。

## 4. devDependencies(開發環境相依套件)

- 只在開發、建置、測試時使用,不會進入正式環境的程式碼。

### 建置工具

| 套件                       | 用途                                                  |
| -------------------------- | ----------------------------------------------------- |
| `vite`                     | 建置與開發伺服器                                      |
| `@vitejs/plugin-vue`       | 讓 Vite 能處理 `.vue` 單一檔案元件(SFC)               |
| `vite-plugin-vue-devtools` | 在開發時整合 Vue DevTools                             |
| `vite-plugin-vuetify`      | Vuetify 的 Vite 外掛,元件按需載入、支援 SCSS 變數覆寫 |
| `sass-embedded`            | 編譯 SCSS 樣式                                        |

### TypeScript 與型別

| 套件               | 用途                                                                                                                                 |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| `typescript`       | TypeScript 編譯器                                                                                                                    |
| `vue-tsc`          | 讓 TypeScript 能檢查 `.vue` 檔                                                                                                       |
| `@tsconfig/node24` | Node 24 的 tsconfig 基底設定                                                                                                         |
| `@vue/tsconfig`    | Vue 專案的 tsconfig 基底設定                                                                                                         |
| `@types/node`      | Node.js 的型別定義                                                                                                                   |
| `@types/lodash-es` | `lodash-es` 的型別定義                                                                                                               |
| `@types/jsdom`     | `jsdom` 的型別定義(`tsconfig.vitest.json` 的 `types` 含 `jsdom`,缺少時 `vue-tsc` 會報 TS2688,`npm run build` 與 Docker 建置都會失敗) |

### 測試

| 套件                    | 用途                                                                                                            |
| ----------------------- | --------------------------------------------------------------------------------------------------------------- |
| `vitest`                | 單元測試框架,與 Vite 共用設定                                                                                   |
| `@vue/test-utils`       | Vue 元件測試工具(掛載、觸發事件、斷言)                                                                          |
| `@testing-library/vue`  | 以使用者角度寫元件測試(取代 @testing-library/react)                                                             |
| `jsdom`                 | 在 Node 模擬瀏覽器 DOM,供 Vitest 跑元件測試(需在 Vitest 設定 `environment: 'jsdom'`,型別由 `@types/jsdom` 提供) |
| `@playwright/test`      | E2E(端對端)測試,模擬真實瀏覽器操作                                                                              |
| `@vitest/eslint-plugin` | 針對 Vitest 測試檔的 ESLint 規則                                                                                |

### Lint 與格式化

| 套件                            | 用途                               |
| ------------------------------- | ---------------------------------- |
| `eslint`                        | 程式碼檢查工具                     |
| `eslint-plugin-vue`             | Vue 專用的 ESLint 規則             |
| `vue-eslint-parser`             | 讓 ESLint 能解析 `.vue` 檔         |
| `@vue/eslint-config-typescript` | Vue + TypeScript 的 ESLint 設定    |
| `eslint-plugin-oxlint`          | 關閉與 Oxlint 重複的 ESLint 規則   |
| `eslint-config-prettier`        | 關閉與 Prettier 衝突的 ESLint 規則 |
| `oxlint`                        | 以 Rust 撰寫的高速 linter          |
| `prettier`                      | 程式碼排版工具                     |

### 樣式檢查

| 套件                               | 用途                                    |
| ---------------------------------- | --------------------------------------- |
| `stylelint`                        | CSS / SCSS 檢查工具                     |
| `stylelint-config-standard-scss`   | SCSS 的標準規則集                       |
| `stylelint-config-recommended-vue` | Vue 單一檔案元件中 `<style>` 的推薦規則 |
| `postcss-html`                     | 讓 Stylelint 能解析 `.vue` 內的樣式區塊 |

### 開發流程工具

| 套件           | 用途                                                                                             |
| -------------- | ------------------------------------------------------------------------------------------------ |
| `husky`        | 管理 Git hooks                                                                                   |
| `lint-staged`  | 只對已 `git add` 的檔案跑檢查,加快 commit 前的驗證。`.husky/pre-commit` 會執行 `npx lint-staged` |
| `npm-run-all2` | 提供 `run-p`(平行)與 `run-s`(依序)指令                                                           |

**lint-staged 設定:** commit 前只對「已暫存(staged)的檔案」依副檔名執行下列指令。

| 檔案類型                         | 執行指令           | 效果               |
| -------------------------------- | ------------------ | ------------------ |
| `*.{js,ts,vue}`                  | `eslint --fix`     | 檢查並自動修正腳本 |
| `*.{css,scss,vue}`               | `stylelint --fix`  | 檢查並自動修正樣式 |
| `*.{js,ts,vue,css,scss,json,md}` | `prettier --write` | 統一排版           |

> `.husky/pre-commit` 會執行 `npx lint-staged`,若 `package.json` 沒有 `lint-staged` 設定,commit 會失敗,兩者需成對存在。

## 5. engines(執行環境限制)

| 欄位           | 值              | 說明                                                                                                                         |
| -------------- | --------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `engines.node` | `>=24.21.0 <25` | 指定可用的 Node 版本範圍:24.21.0 以上、25 以下。版本不符時,npm 預設只會警告;若要強制,需在 `.npmrc` 加上 `engine-strict=true` |

**採用 Node 24.21.0 LTS的理由:** 24.x 是長期支援(LTS,代號 Krypton)版本,適合正式環境,24.21.0 為 2026-09-07 發佈的版本,與 issue 一致。`engines` 寫成範圍而不是釘死單一版本,是因為 Node 版本不屬於套件相依,釘死會讓之後的 24.x 安全性修補版全部觸發警告。要讓團隊本機版本一致,改用 `.nvmrc`(內容 `24.21.0`),搭配 nvm 等版本管理工具切換。

## 6. 版本號寫法補充

本專案的版本號都是**固定版本**(如： `"vue": "3.5.43"`),沒有 `^` 或 `~`。

| 寫法     | 範例      | 意思                                         |
| -------- | --------- | -------------------------------------------- |
| 固定版本 | `3.5.43`  | 只安裝這個版本,團隊與 CI 結果一致,升級需手動 |
| `^`      | `^3.5.43` | 允許升級次版號與修訂號(`3.x.x`)              |
| `~`      | `~3.5.43` | 只允許升級修訂號(`3.5.x`)                    |

> 固定版本的好處是可重現(Reproducible)，缺點是安全性更新要自行追蹤。可搭配 `package-lock.json` 與定期更新相依套件來處理。

### 有 lock 檔時,還需要 `^` 嗎?

`npm ci` / `npm install` 都以 `package-lock.json` 為準,**實際安裝的版本由 lock 決定**,與 `^` 無關。`^` 只影響:執行 `npm install`(無參數)時 lock 是否可能被升級,以及 `npm update` 能升到哪個範圍。

| 比較項目   | 固定版本(本專案)                                                          | `^`                                       |
| ---------- | ------------------------------------------------------------------------- | ----------------------------------------- |
| 升級時機   | 一定是手動、有意識地改                                                    | `npm update` 或 lock 重建時可能自動升     |
| 版本可見性 | `package.json` 即真實版本,diff 看得出變動                                 | 需查 lock 才知實際版本                    |
| 優點       | 可重現、不會悄悄漂移,適合新主版本生態                                     | 自動取得 patch / minor 修正與安全更新     |
| 缺點       | 安全更新需自行追蹤                                                        | 小版本偶有破壞性行為,升級較不可控         |
| 適用情境   | `private` 應用程式;使用 `typescript 6`、`vite 8`、`vitest 4` 等較新主版本 | 發布給他人使用的 library;低風險工具類套件 |

**本專案做法:** 維持固定版本,搭配 Renovate / Dependabot 開 PR 升級,測試通過再合併。若想讓 `npm install xxx` 預設存精確版本,在 `.npmrc` 加上 `save-exact=true`。低風險工具(如 `prettier`、`@types/*`)可選擇性改用 `^`,核心的 `vue`、`vite`、`typescript`、`vuetify` 維持固定。

## 7. 常用指令速查

```bash
npm install            # 安裝相依套件,並觸發 husky 安裝 Git hooks
npm run dev            # 啟動開發伺服器
npm run build          # 型別檢查 + 打包
npm run preview        # 預覽打包結果
npm run test:unit      # 跑一次單元測試
npm run test:e2e       # 跑 E2E 測試(首次先 npx playwright install)
npm run lint           # 依序跑所有 lint 腳本
npm run format         # 排版 src/
```
