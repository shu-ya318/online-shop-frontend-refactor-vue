# Vite 設定檔：vite.config.ts 說明

- 客製化、擴充與微調 Vite 在開發伺服器（Dev Server）與正式打包（Build）時的行為。
- **與 Vitest 關係**： 是否沿用此檔，取決 `vitest.config.ts` 的寫法
  - `mergeConfig(viteConfig, defineConfig({ test: ... }))` 會沿用此檔的 plugins、alias 等設定
  - 獨立的 `defineConfig({ test: ... })` 則不讀此檔。
- **與 ESLint 關係**：
  - 透過專屬的設定檔獨立運作，但可透過插件與 Vite 進行開發期的工作流整合。

- 本文依檔案撰寫順序分為「寫法(defineConfig)」、「base」、「plugins」、「define」、「alias(resolve)」、「css」、「server(含 proxy)」、「preview」八個區域;`optimizeDeps`、`envDir` 未寫入，放在最後說明(環境變數檔的讀取規則併入 `envDir` 一節)。

### 寫法(defineConfig)

#### 設定語法對應效果

| 設定                                                                             | 效果                                                                              |
| -------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `defineConfig({ ... })`(或 `defineConfig(({ mode }) => { ... return { ... } })`) | 物件寫法設定固定不變;函式寫法可依 `--mode` 回傳不同設定                           |
| `const env = loadEnv(mode, process.cwd(), '')`                                   | 在設定檔內讀取 `.env*`;設定檔本身拿不到 `import.meta.env`,要靠 `loadEnv` 才讀得到 |
| `loadEnv` 第二個參數 `process.cwd()`                                             | 從執行指令時所在的目錄讀 `.env*`;`npm run` 會在專案根目錄執行                     |
| `loadEnv` 第三個參數 `''`                                                        | 讀取全部變數，不限 `VITE_` 開頭;只在設定檔內使用，不會因此暴露給前端              |

#### 應避免的錯誤

- 設定需要依環境切換的值(如 `base`、proxy 目標)時仍用物件寫法:拿不到 `mode`,只能寫死。

### base

#### 設定語法對應效果

| 設定                                               | 效果                                                                 |
| -------------------------------------------------- | -------------------------------------------------------------------- |
| 不寫 `base`(或 `base: env.VITE_BASE_URL \|\| '/'`) | 部署的基礎路徑(網站掛在哪個子路徑下);未設定 `VITE_BASE_URL` 時為 `/` |

#### 應避免的錯誤

- `base` 與實際部署的子路徑不一致:打包後的 JS、CSS 路徑錯誤，頁面載入時資源 404。

### plugins

#### 設定語法對應效果

`plugins` 是陣列,依序載入;每個 plugin 負責擴充 Vite 的一項能力。寫法為 `[vue(), vueDevTools(), vuetify({ ... })]`(或 `[vue(), svgLoader()]`)。

| 設定                                                              | 效果                                                                                                           |
| ----------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `vue()`(`@vitejs/plugin-vue`)                                     | 讓 Vite 能編譯 `.vue` 單一檔案元件,Vue 專案必備                                                                |
| `vueDevTools()`(`vite-plugin-vue-devtools`)                       | 開發時提供 Vue DevTools 整合,只在 dev 啟用,不影響打包結果                                                      |
| `vuetify({ autoImport: true })`(`vite-plugin-vuetify`)            | 模板中用到的 Vuetify 元件自動按需引入,不必逐一 import,打包只含實際用到的元件                                   |
| `vuetify({ styles: { configFile: 'src/styles/settings.scss' } })` | 用 Sass 覆寫 Vuetify 的斷點與字級;路徑相對於專案根目錄                                                         |
| `svgLoader()`(`vite-svg-loader`)                                  | 讓 SVG 可當成 Vue 元件載入(`import Icon from './icon.svg?component'`);型別宣告見 `typescript.md` 的 `env.d.ts` |

#### 應避免的錯誤

- 漏掉 `vue()`:`.vue` 檔無法編譯。
- `styles.configFile` 路徑與實際檔案不一致,Vuetify 樣式編譯失敗。
- 只設 `createVuetify` 的 `display.thresholds`、沒用 `configFile` 覆寫斷點:`d-md-none` 這類 CSS class 的斷點不會跟著改。

### define

#### 設定語法對應效果

| 設定                                                                                         | 效果                                                      |
| -------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| 不寫 `define`(或 `define: { __APP_VERSION__: JSON.stringify(version) }`)                     | 打包時把程式中的 `__APP_VERSION__` 直接替換成版本號字串   |
| `JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf-8'))` 取 `version` | 版本號來源為 `package.json` 的 `version`,不必另外手動維護 |

#### 應避免的錯誤

- 值沒用 `JSON.stringify` 包住:`define` 是原文替換，版本號會變成一段不帶引號的程式碼，執行時語法錯誤。
- 只寫 `define` 沒在 `env.d.ts` 宣告 `declare const __APP_VERSION__`:type-check 報找不到名稱。

### alias(放在 `resolve` 內)

`alias` 屬於「模組解析」,所以寫在 `resolve: { alias: { ... } }` 底下。

#### 設定語法對應效果

| 設定                                               | 效果                                                                                              |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `'@'` → `src`(只留這一條)                          | 路徑別名只有一條規則,新增資料夾不必改設定,Vite 與 TypeScript 不會不同步                           |
| 對應 tsconfig 的 `"@/*": ["./src/*"]`              | 兩邊規則一致,import 路徑可正常使用                                                                |
| `fileURLToPath(new URL('./src', import.meta.url))` | 以此檔案位置換算出 `src` 的絕對路徑,不依賴執行指令時所在的目錄(ESM 沒有 `__dirname`,用此寫法取代) |

#### 應避免的錯誤

- 錯誤1：每個資料夾各寫一條 alias，tsconfig 的 `paths` 又各寫一條:同一件事寫在兩處,新增資料夾要改兩次;import 路徑能否使用,取決於兩份設定是否剛好一致。

### css

#### 設定語法對應效果

| 設定                                                                                                     | 效果                                                                 |
| -------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| 不寫 `css`(或 `css.postcss.plugins: [autoprefixer()]`)                                                   | 依 `package.json` 的 `browserslist` 自動補上 CSS 前綴(如 `-webkit-`) |
| `css.preprocessorOptions.scss.loadPaths: [fileURLToPath(new URL('./src/assets/scss', import.meta.url))]` | SCSS 的 `@use` 會多找 `src/assets/scss`,共用樣式不必寫相對路徑       |

#### 應避免的錯誤

- 在 `vite.config.ts` 寫了 `css.postcss`,又另外新增 `postcss.config.js`:Vite 只用設定檔內的寫法，外部檔案不會被讀取。

### server(含 proxy)

`server` 是開發伺服器(dev server)的設定。`proxy` 寫在 `server: { proxy: { ... } }` 底下，只在 `npm run dev` 生效(預覽時 `preview` 預設沿用),打包後不會帶入使用，部署時由 nginx 反向代理負責。

#### 設定語法對應效果

| 設定                                                                                                                     | 效果                                                       |
| ------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------- |
| 不寫 `host`(或 `host: '0.0.0.0'`)                                                                                        | 監聽所有網路介面，同網段裝置或容器外部也能連到 dev server  |
| 不寫 `port`(或 `port: 5173`)                                                                                             | dev server 的埠號，預設即為 `5173`                         |
| 不寫 `strictPort`(或 `strictPort: true`)                                                                                 | 設為 `true` 時埠號被佔用就直接報錯結束，不自動改用下一個埠 |
| `/api/v1` → `http://localhost:8082`,`changeOrigin: true`(或 `[env.VITE_API_PROXY_PREFIX]` → `env.VITE_API_PROXY_TARGET`) | API 請求轉給後端,並把請求的 Host 標頭改成目標主機          |
| `/ws`,`ws: true` → `ws://localhost:8082`                                                                                 | WebSocket 轉給後端                                         |
| 前端一律用相對路徑(同源)                                                                                                 | 不寫死後端網址以避免遇到 CORS,部署時同源路徑可直接沿用     |

#### 應避免的錯誤

- nginx.conf 反向代理的路徑要與此處(`/api/v1`、`/ws`)一致,否則開發環境與部署後的行為不同。
- proxy 前綴改讀 `env.VITE_API_PROXY_PREFIX`,但 `.env*` 沒設這個變數:key 會變成字串 `undefined`,API 請求不會被轉發。

### preview

`npm run preview` 用來在本機預覽打包後的 `dist/`,需先執行 build。

#### 設定語法對應效果

| 設定                                                                            | 效果                                            |
| ------------------------------------------------------------------------------- | ----------------------------------------------- |
| 不寫 `preview`(或 `preview: { host: '0.0.0.0', port: 4173, strictPort: true }`) | 預覽伺服器的監聽位址與埠號，預設埠號即為 `4173` |

#### 應避免的錯誤

- `4173` 被其他程式佔用且 `strictPort: true`:`npm run preview` 直接報錯結束(E2E 的 `webServer` 也依賴此埠，見 `docs/testing/playwright.md`)。

### optimizeDeps(未寫入)

#### 設定語法對應效果

| 設定                | 效果                                                        |
| ------------------- | ----------------------------------------------------------- |
| 不寫 `optimizeDeps` | 預先打包交給 Vite 自動處理,不再出現「找不到套件」的錯誤訊息 |

#### 應避免的錯誤

- 手動設定 `optimizeDeps.include` 預先打包套件。因 Vite 本來就會自動找出需預先打包的相依套件,通常只有它找不到時 (如：「第一次進某一頁特別慢、Vite 重新整理頁面」)才需要手寫。

### envDir(未寫入)

#### 設定語法對應效果

| 設定                                                                   | 效果                                                                                                             |
| ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| 不寫 `envDir`                                                          | Vite 從專案根目錄讀取 `.env*`;`.env.example` 放在根目錄                                                          |
| `.env`                                                                 | 所有 mode 共用的預設值                                                                                           |
| `.env.local`                                                           | 本機覆寫用，不進版控(複製 `.env.example` 後修改)                                                                 |
| `.env.[mode]`(如 `--mode dev` → `.env.dev`、`--mode uat` → `.env.uat`) | mode 專屬檔案，會覆蓋 `.env` 的同名變數                                                                          |
| 不帶 `--mode`                                                          | `dev` 指令預設 `development`;`build`、`build-only`、`preview` 預設 `production`,只讀 `.env` 與 `.env.production` |

常用變數(前端程式使用的 `VITE_API_BASE_URL`、`VITE_WS_URL` 見 `docs/repo/env.md`):

| 變數                    | 說明                             | 使用時機         |
| ----------------------- | -------------------------------- | ---------------- |
| `VITE_APP_TITLE`        | 應用程式標題，用於瀏覽器分頁標題 | 開發、建置       |
| `VITE_APP_ENV`          | 環境名稱，需與 mode 一致         | 開發、建置       |
| `VITE_BASE_URL`         | 部署的 base 路徑，未設定時為 `/` | 開發、建置、預覽 |
| `VITE_API_PROXY_PREFIX` | 要轉發到後端的 API 路徑前綴      | 開發、預覽       |
| `VITE_API_PROXY_TARGET` | 後端位址                         | 開發、預覽       |

#### 應避免的錯誤

- `envDir` 指向不存在的資料夾(本專案曾設 `envDir: 'env'`,但沒有 `env/`),Vite 讀不到任何 `.env*`,`import.meta.env.VITE_*` 全是 `undefined`,且不會報錯。
- 只有 `VITE_` 開頭的變數會暴露給前端,機密資訊不可放在這裡(見 `docs/repo/env.md`)。
- 打包時沒帶 `--mode`:讀到的是 `.env.production`,不是 `.env.dev` / `.env.uat`,需要指定環境時改用帶 mode 的指令(如 `build:dev`、`build:uat`)。
