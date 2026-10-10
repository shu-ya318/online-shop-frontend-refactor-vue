# 專案設定檔之調整與優化

建議從底層往上、每一步都驗證通過再做下一步,並且每步一個 commit。順序如下。

## 0. [已完成]先固定套件版號

- 升級 Node 到 24.21.0,執行 npm install 產生 package-lock.json。
- 先 commit 一次「依賴與鎖檔」,之後設定壞掉才能回到這個狀態。
- 驗收:npm ci 成功,npm run dev 能開出空白頁。

## 1. 統一型別與路徑(tsconfig、env.d.ts、@ 別名)

- 這是最底層,Vite、Vitest、ESLint 都依賴它。先改這裡,後面才不會連環出錯。
- 驗收:npm run type-check 通過。

### 錯誤的現象和理由

- 手動設定 `optimizeDeps.include` 預先打包 d3、xlsx、@mui/x-data-grid:這些套件 Vue 版都沒安裝,留著只會出現「找不到套件」的錯誤訊息。Vite 本來就會自動找出需預先打包的依賴,通常只有它找不到時才需要手寫。
- 每個資料夾各寫一條 alias(共 8 條),tsconfig 的 `paths` 又要各寫一條,且兩邊已經不同步(tsconfig 只有 7 條,少了 `@/assets`)。同一件事寫在兩處,新增資料夾要改兩次;import 路徑能否使用,取決於兩份設定是否剛好一致。

### 調整作法

- 移除 `optimizeDeps`;真的遇到「開發時第一次進某一頁特別慢、Vite 重新整理頁面」再加回來。
- 只留一條 alias:`vite.config.ts` 為 `'@'` → `src`,`tsconfig.app.json` 對應一條 `"@/*": ["./src/*"]`(`tsconfig.vitest.json` 繼承,不另寫)。
- 開發伺服器 proxy:`/api/v1` 轉給 `http://localhost:8082`,`/ws` 以 `ws: true` 轉給 `ws://localhost:8082`,前端一律用相對路徑(同源)。

### 效益

- 不再有找不到套件的錯誤訊息,依賴預先打包交給 Vite 自動處理。
- 路徑只有 `@` 一條規則,新增資料夾不必改設定,Vite 與 TypeScript 不會再不同步。
- 前端不寫死後端網址,也不需處理 CORS,部署時同源路徑可直接沿用。

## 2. Vite 設定(vite.config.ts、Vuetify 外掛、SCSS 入口)

- 路徑別名、Vuetify 外掛的 styles.configFile、src/styles/settings.scss 要一起確認。
- 驗收:npm run build 通過,npm run preview 看得到 Vuetify 樣式。

## 3. 調整專案結構

- 結構決定後面設定檔裡的路徑,所以放在 lint 和測試設定之前。
- 先把目錄定下來(例如 views/、components/、composables/、api/、schemas/),再一次搬完。
- 邊搬邊跑型別檢查,重點是別一次動太多。
- 驗收:type-check 和 build 通過。

## 4. 測試設定(vitest.config.ts、tsconfig.vitest.json、playwright.config.ts)

- 設定 Vitest 的 jsdom 環境和 Vuetify 掛載(元件測試常見的坑)。
- 路徑要跟第 3 步的結構一致。
- 驗收:npm run test:unit 通過一支範例測試。再執行 npx playwright install 並跑通 test:e2e。

## 5. Lint 與格式化(ESLint、Oxlint、Stylelint、Prettier、.editorconfig)

- 放在結構穩定之後,因為這些設定有檔案範圍(glob),結構一動就要重改。
- 改完後先跑一次全專案 npm run lint 與 npm run format,把自動修正的結果獨立成一個 commit,避免和邏輯修改混在一起。
- 驗收:npm run lint 沒有錯誤。

## 6. Git hooks(husky、lint-staged)

- 最後才接,否則前面每個 commit 都會被擋。
- 驗收:故意改壞一個檔案 commit,確認會被擋住。

## 7. 應用程式層(Pinia、Router、i18n、Keycloak、useZodForm)
