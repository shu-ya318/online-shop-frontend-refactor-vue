# 專案設定檔之調整與優化

建議從底層往上、每一步都驗證通過再做下一步,並且每步一個 commit。點擊各標題可展開 / 收合內容。

**順序總覽**:package.json → vite.config → tsconfig → ESLint 與 Prettier → index.html → main.ts → Dockerfile 與 nginx.conf → .gitignore、.npmrc 與環境變數 → 專案結構 → 測試 → Git hooks → 應用程式層。

<details>
<summary><h2>0. package.json 與套件版號 [已完成]</h2></summary>

- 升級 Node 到 24.21.0,執行 npm install 產生 package-lock.json。
- 先 commit 一次「依賴與鎖檔」,之後設定壞掉才能回到這個狀態。
- 驗收:npm ci 成功,npm run dev 能開出空白頁。

</details>

<details>
<summary><h2>1. vite.config(plugin、alias 與 proxy)</h2></summary>

- 這是最底層,Vite、Vitest、ESLint 都依賴它。先改這裡,後面才不會連環出錯。
- 驗收:npm run type-check 通過。

### 錯誤的現象和理由

- 手動設定 `optimizeDeps.include` 預先打包 d3、xlsx、@mui/x-data-grid:這些套件 Vue 版都沒安裝,留著只會出現「找不到套件」的錯誤訊息。Vite 本來就會自動找出需預先打包的依賴,通常只有它找不到時才需要手寫。
- 每個資料夾各寫一條 alias(共 8 條),tsconfig 的 `paths` 又要各寫一條,且兩邊已經不同步(tsconfig 只有 7 條,少了 `@/assets`)。同一件事寫在兩處,新增資料夾要改兩次;import 路徑能否使用,取決於兩份設定是否剛好一致。

### 調整作法

- 移除 `optimizeDeps`;真的遇到「開發時第一次進某一頁特別慢、Vite 重新整理頁面」再加回來。
- 只留一條 alias:`'@'` → `src`(tsconfig 端的對應見第 2 步)。
- 開發伺服器 proxy:`/api/v1` 轉給 `http://localhost:8082`,`/ws` 以 `ws: true` 轉給 `ws://localhost:8082`,前端一律用相對路徑(同源)。

### 效益

- 不再有找不到套件的錯誤訊息,依賴預先打包交給 Vite 自動處理。
- 路徑只有 `@` 一條規則,新增資料夾不必改設定,Vite 與 TypeScript 不會再不同步。
- 前端不寫死後端網址,也不需處理 CORS,部署時同源路徑可直接沿用。

</details>

<details>
<summary><h2>2. tsconfig(tsconfig.app.json、tsconfig.vitest.json)</h2></summary>

- 緊接在 vite.config 之後,與其 alias 成對修改。
- `tsconfig.app.json` 只留一條 `"@/*": ["./src/*"]`,與 vite 的 `'@'` 對應。
- `tsconfig.vitest.json` 繼承 app 設定,不另寫 `paths`。
- `include` 使用寬鬆範圍(如 `src/**/*`),不綁定特定資料夾,結構調整時才不必再改。
- 驗收:npm run type-check 通過。

### review 重點:tsconfig.app.json

#### 1. `compilerOptions` 沒有明寫 `strict`

- 問題:`compilerOptions` 裡沒有寫 `strict`。TypeScript 6 起 strict 預設開啟,所以現在其實是嚴格模式,只是設定檔看不出來。
- 後果:讀設定的人會以為沒有開;之後如果改成繼承別的 base 設定、或換了 TypeScript 版本,嚴格檢查可能被悄悄關掉而沒人發現。
- Vue 版:base 設定(`@vue/tsconfig`)已經開了 `strict`,app 再明寫一次(參考 tsconfig.app.json 第 6–7 行)。

#### 2. `paths` 每個資料夾一條

- 問題:`paths` 每個資料夾一條,共 7 條,和 vite.config 的 8 條 alias 一一對應(少了 `@/assets`)。
- 後果:同一件事寫兩份,已經不同步(見第 1 步「錯誤的現象和理由」第二點)。
- Vue 版:只留 `"@/*": ["./src/*"]` 一條(參考 tsconfig.app.json 第 19–21 行)。

</details>

<details>
<summary><h2>3. ESLint 與 Prettier(含 Oxlint、Stylelint、.editorconfig)</h2></summary>

- 規則依賴 TypeScript 與 alias 解析,所以排在 tsconfig 之後。
- glob 一律寫成 `src/**/*`、`**/*.{ts,vue}` 這類寬範圍,不要指定到個別資料夾,之後搬結構就不必重改。
- 改完後先跑一次全專案 npm run lint 與 npm run format,把自動修正的結果獨立成一個 commit,避免和邏輯修改混在一起。
- 驗收:npm run lint 沒有錯誤。

</details>

<details>
<summary><h2>4. index.html</h2></summary>

- 確認 `lang`、`<title>`、favicon、viewport,以及入口 `<script type="module" src="/src/main.ts">` 路徑正確。
- 驗收:npm run dev 頁籤標題與圖示正確。

</details>

<details>
<summary><h2>5. main.ts(原 React 的 main.tsx 對應)</h2></summary>

- 入口只負責建立 app 與掛載,先保持最小可執行,Pinia、Router、i18n、Keycloak 留到第 11 步再接。
- 確認副檔名與 index.html 中的路徑一致(Vue 為 `main.ts`,不是 `main.tsx`)。
- 驗收:npm run dev 能掛載並顯示根元件。

</details>

<details>
<summary><h2>6. Dockerfile 與 nginx.conf</h2></summary>

- Dockerfile 的 Node 版本與第 0 步一致,用 `npm ci` 安裝,多階段建置(build → nginx)。
- nginx.conf 設定 SPA fallback(`try_files $uri /index.html`),並把 `/api/v1`、`/ws` 反向代理到後端,與第 1 步 dev proxy 的路徑保持一致。
- 驗收:docker build 成功,容器啟動後能開頁面,重新整理子路由不會 404。

</details>

<details>
<summary><h2>7. .gitignore、.npmrc 與環境變數</h2></summary>

- `.gitignore` 排除 node_modules、dist、`.env.local`、測試報告等產出物。
- `.npmrc` 固定 registry 與 engine 檢查(如 `engine-strict=true`),與第 0 步版號一致。
- 環境變數:提供 `.env.example`,只有 `VITE_` 開頭的值會暴露給前端,機密資訊不放前端。
- 驗收:`git status` 沒有多餘的產出物;缺少環境變數時有明確提示。

</details>

<details>
<summary><h2>8. 調整專案結構</h2></summary>

- 放在所有設定檔之後是合適的:設定檔都已用寬範圍 glob 與單一 `@` alias,搬資料夾幾乎不必再動設定,風險最低。
- 但不放在最末端,而是在測試、Git hooks 與應用程式層之前:測試路徑與應用程式碼都依賴結構,若先寫完再搬,等於重做。
- 先把目錄定下來(例如 views/、components/、composables/、api/、schemas/),再一次搬完。
- 邊搬邊跑型別檢查,重點是別一次動太多。
- 驗收:type-check、lint 和 build 通過。

</details>

<details>
<summary><h2>9. 測試設定(vitest.config.ts、playwright.config.ts)</h2></summary>

- 設定 Vitest 的 jsdom 環境和 Vuetify 掛載(元件測試常見的坑)。
- 路徑要跟第 8 步的結構一致。
- 驗收:npm run test:unit 通過一支範例測試。再執行 npx playwright install 並跑通 test:e2e。

</details>

<details>
<summary><h2>10. Git hooks(husky、lint-staged)</h2></summary>

- 最後才接,否則前面每個 commit 都會被擋。
- 驗收:故意改壞一個檔案 commit,確認會被擋住。

</details>

<details>
<summary><h2>11. 應用程式層(Pinia、Router、i18n、Keycloak、useZodForm)</h2></summary>

- 在結構、測試與 hooks 都就緒後,才開始寫實際功能,並回到 main.ts 逐一註冊。

</details>
