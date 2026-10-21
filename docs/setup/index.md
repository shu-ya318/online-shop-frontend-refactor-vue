# 專案設定檔之調整與優化筆記

**順序總覽**:package.json → vite.config → tsconfig → Lint(ESLint 與 Prettier) → index.html → main.ts → Dockerfile 與 nginx.conf → .gitignore、.npmrc 與環境變數 → 調整專案結構 → 測試 → Git hooks

## 步驟與驗收總表

| 步驟 | 項目                                                    | 驗收                                                                            |
| ---- | ------------------------------------------------------- | ------------------------------------------------------------------------------- |
| 0    | package.json 與套件版號                                 | `npm ci` 成功,`npm run dev` 能開出空白頁                                        |
| 1    | vite.config(plugin、alias 與 proxy)                     | `npm run type-check` 通過                                                       |
| 2    | tsconfig(tsconfig.app.json、tsconfig.vitest.json)       | `npm run type-check` 通過                                                       |
| 3    | ESLint 與 Prettier(含 Oxlint、Stylelint、.editorconfig) | `npm run lint` 沒有錯誤                                                         |
| 4    | index.html                                              | `npm run dev` 分頁標題與圖示正確                                                |
| 5    | main.ts(原 React 的 main.tsx 對應)                      | `npm run dev` 能掛載並顯示根元件                                                |
| 6    | Dockerfile 與 nginx.conf                                | `docker build` 成功,容器啟動後能開頁面,重新整理子路由不會 404                   |
| 7    | .gitignore、.npmrc 與環境變數                           | `git status` 沒有多餘的建置產物;缺少環境變數時有明確提示                        |
| 8    | 調整專案結構                                            | type-check、lint 和 build 通過                                                  |
| 9    | 測試設定(vitest.config.ts、playwright.config.ts)        | `npm run test:unit` 通過一支範例測試;`npx playwright install` 後跑通 `test:e2e` |
| 10   | Git hooks(husky、lint-staged)                           | 故意改壞一個檔案 commit,確認會被擋住                                            |
| 11   | 應用程式層(Pinia、Router、i18n、Keycloak、useZodForm)   | (無)                                                                            |

## package.json(含 package-lock.json)

見[package-json.md](package-json.md)。

#### 應避免的錯誤

- 錯誤1：不固定套件版號
  - package-lock.json 列進 .gitignore 不做版控，同時 package.json 的版本大多寫成 ^x.y.z (「同一個大版本內、這個版本以上都可以」)。
- 後果
  - 每次在乾淨環境 npm install，都可能裝到不同版本（間接依賴也一樣）。出問題時也無法還原當時版本。

- 錯誤2：高度關聯的套件版本衝突
  - React 和 react-is (用來判斷「這個值是不是某種 React 元素」) 大版本範圍不一致。
- 後果
  - 要用 `npm ls react-is` 才查得到是誰需要它、實際用到哪一版。

- 錯誤3：安裝有安全疑慮且不再更新的套件
  - npm 上的 xlsx 停在 0.18.5,該版本有公開的安全問題(讀取檔案時觸發);之後的版本只在 SheetJS 官網發布。專案只有一個管理頁面用它匯出 Excel。
- 後果
  - 頁面一開始就全部載入,每個使用者都會下載這個套件;`npm audit` 也會一直報。
  - Vue 版做法:改照 SheetJS 官方方式安裝,並用 `await import('xlsx')` 在按下匯出時才載入。

- 錯誤4：裝了完整套件卻只用到一小部分
  - 裝了完整的 `d3`,實際只用到 d3-zoom 和 d3-selection;`@types/d3-ease`、`@types/d3-shape` 沒有地方用。
- 後果
  - 依賴清單看不出真正用了什麼,升級和安全掃描的範圍都變大。
  - Vue 版做法:只裝 d3-zoom、d3-selection 兩個子套件。
    - 使用 `npm install d3-zoom d3-selectionc` 和 `npm install -D @types/d3-zoom @types/d3-selection`
    - d3 的子套件不內建型別,所以型別套件另外裝,且只裝實際用到的。
    - 如果路網圖元件只在特定頁面使用,可用動態 import() 載入,避免拖慢首頁。

- 錯誤5：裝了 Prettier 相關套件卻沒有設定檔
  - prettier、eslint-config-prettier、eslint-plugin-prettier 都裝了,但專案沒有 `.prettierrc`,`eslint.config.js` 。
- 後果
  - Vue 版做法:create-vue 產生 `.prettierrc.json` 並接上 eslint-config-prettier,用 `npm run format` 統一格式。

## .nvmrc

本機 Node 版本。

### 與 .npmrc 的差異

兩者**不同性質**:`.nvmrc` 管「用哪個 Node」,`.npmrc` 管「npm 怎麼運作」,各自由不同工具讀取。

| 項目     | `.nvmrc`                                                 | `.npmrc`                                              |
| -------- | -------------------------------------------------------- | ----------------------------------------------------- |
| 讀取者   | nvm(Node 版本管理工具),`nvm use` 時讀取                  | npm 本身,每次執行 npm 指令時讀取                      |
| 管什麼   | 本機使用的 Node 版本                                     | npm 行為設定(`save-exact`、registry、`engine-strict`) |
| 本專案值 | `24.21.0`                                                | `save-exact=true`                                     |
| 強制力   | 只是切換依據,不會阻擋安裝                                | 設定即生效;搭配 `engine-strict=true` 才會擋版本不符   |
| 關聯     | 與 package.json `engines`、Dockerfile 的 Node 版本需一致 | 可用 `engine-strict` 讓 `engines` 變成強制檢查        |

> Windows 的 nvm-windows 不會自動讀取 `.nvmrc`,需手動 `nvm use 24.21.0`;`.nvmrc` 在此主要作為團隊與其他工具(如： CI)的版本依據。

### Node 版本

#### 設定語法對應效果

| 設定      | 效果                                                                                |
| --------- | ----------------------------------------------------------------------------------- |
| `24.21.0` | 以 nvm 切換版本時讀取此檔,本機版本與 package.json 的 `engines`(`>=24.21.0 <25`)相符 |

#### 應避免的錯誤

- 版號與 package.json、Dockerfile 不一致,導致本機與建置環境的 Node 版本不同。

### registry 與 engine

#### 設定語法對應效果

| 設定                              | 效果                                        |
| --------------------------------- | ------------------------------------------- |
| `save-exact=true`(目前檔案內容)   | 安裝套件時寫入精確版本,不加 `^`             |
| 固定 registry(第 7 步建議)        | 套件來源一致                                |
| `engine-strict=true`(第 7 步建議) | Node 版本不符時安裝即報錯,與第 0 步版號一致 |

#### 應避免的錯誤

- engine 要求的版本與 package.json 採用的 Node 版號不一致。

## .npmrc

一個區域:registry 與 engine 檢查。與 `.nvmrc` 的差異見上方 `.nvmrc` 一節:`.npmrc` 管 npm 行為,`.nvmrc` 管 Node 版本。

### .npmrc-nexus.example

#### 內網 registry 範本

##### 設定語法對應效果

| 設定                                                       | 效果                                     |
| ---------------------------------------------------------- | ---------------------------------------- |
| `registry=https://<內網 Nexus 主機>/repository/npm-group/` | 套件來源改為內網 Nexus 的 npm-group      |
| `cafile=/path/to/internal-ca.pem`                          | 指定內網自簽憑證的 CA 檔,仍保有 SSL 驗證 |

##### 應避免的錯誤

- 內網使用自簽憑證時,以 `strict-ssl=false` 關閉 SSL 檢查;建議改為指定 CA 憑證檔(`cafile`)。
- 把實際設定放進映像檔:`.dockerignore` 已排除 `.npmrc-nexus`。

## Vite 設定檔：vite.config.ts

見[vite.md](vite.md)。

## TypeScript 設定檔：tsconfig.json、tsconfig.app.json、tsconfig.node.json、tsconfig.vitest.json

見[typescript.md](typescript.md)。

## 型別檢查、排版、編輯類工具設定檔：eslint.config.ts、.oxlintrc.json、.prettierrc.json、.editorconfig

見[linter-formatter-editor.md](linter-formatter-editor.md)。
