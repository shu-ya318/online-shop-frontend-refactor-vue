# 專案結構

## (一) Vue 3 專案主流的專案結構

官方腳手架 `create-vue` 產生的結構是社群共同的起點:設定檔放根目錄,程式碼放 `src/`,測試與部署相關檔案各自獨立。

### 根目錄

| 項目                                                                               | 用途                                               |
| ---------------------------------------------------------------------------------- | -------------------------------------------------- |
| `package.json`、`package-lock.json`                                                | 依賴與指令;lockfile 進版控,讓安裝結果可重現        |
| `vite.config.ts`、`vitest.config.ts`、`playwright.config.ts`                       | 建置、單元測試、e2e 測試設定                       |
| `tsconfig.json`、`tsconfig.app.json`、`tsconfig.node.json`、`tsconfig.vitest.json` | TypeScript 設定,依執行環境(瀏覽器、Node、測試)拆分 |
| `eslint.config.ts`、`.prettierrc.json`、`.editorconfig`                            | 程式碼風格與檢查                                   |
| `index.html`                                                                       | Vite 的入口 HTML(在根目錄,不在 `public/`)          |
| `public/`                                                                          | 原樣複製到輸出的靜態檔(如 favicon),不經過打包      |
| `e2e/`                                                                             | 端對端測試                                         |
| `.env*`                                                                            | 環境變數                                           |

### src/ 依類型分層

`src/` 裡依「檔案的類型」分資料夾,是小到中型專案最常見的做法:

| 目錄                 | 放什麼                                     |
| -------------------- | ------------------------------------------ |
| `assets/`            | 會被打包處理的圖片、字型                   |
| `components/`        | 可重用的元件                               |
| `composables/`       | 以 `use` 開頭的組合式函式(如 `useAuth.ts`) |
| `views/`             | 對應路由的頁面元件                         |
| `layouts/`           | 頁面外框(導覽列、側邊欄等)                 |
| `router/`            | Vue Router 設定                            |
| `stores/`            | Pinia 狀態                                 |
| `plugins/`           | 全域外掛的初始化(i18n、UI 框架)            |
| `api/`、`services/`  | 與後端或外部系統溝通                       |
| `types/`、`utils/`   | 型別定義、純函式工具                       |
| `App.vue`、`main.ts` | 根元件與應用程式入口                       |

專案變大時,社群常改成「依功能模組分」(`features/auth/`、`features/chat/`,每個模組自帶 components、api、stores),或兩者混合。依類型分層的優點是規則簡單、上手快;缺點是功能增加後,同一個功能的檔案會散在各個資料夾。

### 常見的命名慣例

- 元件檔與資料夾用 PascalCase(`UserCard.vue`)。
- composable 用 `useXxx.ts`,store 用 `useXxxStore`。
- 路徑別名統一用 `@` 指向 `src`,避免 `../../` 的相對路徑。
- 只有 `VITE_` 開頭的環境變數會暴露給前端,機密資訊不放前端。

## (二) 本專案的結構

本專案採用「依類型分層」,並把環境變數與 nginx 相關檔案各自歸入資料夾。

```
lookGo-frontend-vue3/
├─ docs/                      # 專案文件
├─ e2e/                       # Playwright 端對端測試
├─ env/                       # 環境變數
│  ├─ .env.example            #   範本(進版控)
│  └─ env.d.ts                #   環境變數的型別宣告
├─ nginx/                     # 正式環境的 nginx
│  ├─ nginx.conf              #   設定範本(容器啟動時由 envsubst 代入變數)
│  └─ 15-default-dns-resolver.envsh   # 啟動時補預設 DNS_RESOLVER
├─ public/                    # 靜態檔
├─ src/
│  ├─ api/                    # 只負責打 HTTP:axios instance、攔截器、各領域 API 函式
│  ├─ assets/                 # 圖片、字型
│  ├─ components/             # 共用元件
│  ├─ composables/            # useXxx.ts
│  ├─ config/                 # 應用層設定與常數
│  ├─ layouts/                # 頁面外框
│  ├─ locales/                # 語系檔(en、zh-TW)
│  ├─ plugins/                # i18n、vuetify 初始化
│  ├─ router/                 # 路由
│  ├─ services/               # 整合與商業邏輯(Keycloak、STOMP、PDF 等)
│  ├─ stores/                 # Pinia
│  ├─ styles/                 # 全域樣式與 Vuetify 設定
│  ├─ types/                  # 型別定義
│  ├─ utils/                  # 純函式工具
│  ├─ views/                  # 路由頁面
│  ├─ __tests__/              # 單元測試
│  ├─ App.vue
│  └─ main.ts
├─ .dockerignore
├─ Dockerfile
├─ vite.config.ts、vitest.config.ts、playwright.config.ts
├─ tsconfig*.json、eslint.config.ts、...
└─ package.json
```

目前新增的 `api/`、`assets/`、`components/` 等資料夾還是空的(以 `.gitkeep` 佔位),有檔案後可移除 `.gitkeep`。

### 與官方預設不同、需要注意的地方

**1. 環境變數集中在 `env/`**

- `vite.config.ts` 設定了 `envDir: 'env'`,Vite 才會從這裡讀 `.env*`。
- `tsconfig.app.json` 與 `tsconfig.vitest.json` 的 `include` 指向 `env/env.d.ts`。
- 實際使用時,複製 `env/.env.example` 成 `env/.env.local` 再修改。`.gitignore` 已排除 `.env` 與 `.env.*`,只保留 `.env.example`。
- 注意:`VITE_` 開頭的變數在 `npm run build` 時就寫進 bundle,部署後改環境變數不會生效。

**2. nginx 相關檔案集中在 `nginx/`**

- `nginx.conf` 與 `15-default-dns-resolver.envsh` 都是「只在 Docker 映像裡用到」的檔案,放在同一個資料夾,Dockerfile 的 `COPY` 路徑一目了然。
- 原本的 `docker/` 資料夾已併入,不再單獨存在。
- Dockerfile 把 `nginx.conf` 放進 `/etc/nginx/templates/`,由 nginx 映像的 entrypoint 以 envsubst 代入 `BACKEND_URL` 與 `DNS_RESOLVER`。

**3. 新增 `.dockerignore`**

- 排除 `node_modules`、`.git`、`dist`、`.env*`、`e2e`、`docs` 等,縮小 build context、避免把本機環境變數帶進映像。

**4. `api/` 與 `services/` 的分工**

這兩個資料夾容易重疊,先定義清楚:

|          | `api/`                     | `services/`                                 |
| -------- | -------------------------- | ------------------------------------------- |
| 職責     | 只打 HTTP                  | 整合與商業邏輯                              |
| 輸入輸出 | 傳入參數,回傳 response     | 組合多個 api 或外部系統後回傳結果           |
| 例子     | `auth.api.ts` 的 `login()` | Keycloak 登入流程、STOMP 連線管理、PDF 產生 |

**5. 在官方預設之外保留的資料夾**

- `plugins/`、`locales/`、`styles/`:本專案用了 vue-i18n 與 Vuetify,需要這些資料夾。
- `composables/`:Vue 3 慣例的 composable 目錄。
- `__tests__/`:單元測試集中放在 `src/__tests__/`(`tsconfig.app.json` 排除、`tsconfig.vitest.json` 納入)。`tsconfig.vitest.json` 的 `types` 含 `jsdom`,對應的型別由 devDependency `@types/jsdom` 提供,版本與 `jsdom` 主版號保持一致。

### 擴充時的建議

- 新增檔案前先確認它屬於哪個資料夾,規則見上表。
- 如果同一個功能(例如聊天室)的檔案開始散落在 `components/`、`api/`、`stores/`、`composables/` 多處、難以維護,再考慮改成 `features/<功能>/` 的功能模組結構。
