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
│  ├─ assets/                 # 圖片、字型
│  ├─ components/             # 共用元件
│  ├─ composables/            # 複用邏輯 useXxx.ts
│  ├─ config/                 # 應用層設定與常數
│  ├─ layouts/                # 頁面外框
│  ├─ locales/                # 語系檔(en、zh-TW)
│  ├─ plugins/                # i18n、vuetify 初始化
│  ├─ router/                 # 路由
│  ├─ services/               # 與後端或外部系統溝通
│  ├─ stores/                 # Pinia(authStore、userStore、metroMapStore、stationStore、stationBookmarkStore)
│  ├─ styles/                 # 全域樣式與 Vuetify 設定
│  ├─ types/                  # 型別定義
│  ├─ utils/                  # 純函式工具
│  ├─ views/                  # 路由頁面
│  ├─ test/                   # 測試共用工具(setup.ts、testUtils.ts)
│  ├─ __tests__/              # 橫跨多層的單元測試(如 App.spec.ts)
│  ├─ App.vue
│  └─ main.ts
├─ .dockerignore
├─ Dockerfile
├─ vite.config.ts、vitest.config.ts、playwright.config.ts
├─ tsconfig*.json、eslint.config.ts、...
└─ package.json
```

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

這兩個資料夾容易重疊,先定義清楚。**目前實際做法**:所有 HTTP 與 WebSocket 都放在 `services/`(`http.ts`、`tokenManager.ts`、`errors.ts`、各領域資料夾),`api/` 仍是空的,先不拆;等 services 變複雜再把純 HTTP 的部分搬到 `api/`。細節見 [request-flow.md](./request-flow.md)、[error-handling.md](./error-handling.md)、[socket.md](./socket.md)。

|          | `api/`                     | `services/`                                 |
| -------- | -------------------------- | ------------------------------------------- |
| 職責     | 只打 HTTP                  | 整合與商業邏輯                              |
| 輸入輸出 | 傳入參數,回傳 response     | 組合多個 api 或外部系統後回傳結果           |
| 例子     | `auth.api.ts` 的 `login()` | Keycloak 登入流程、STOMP 連線管理、PDF 產生 |

**5. 在官方預設之外保留的資料夾**

- `plugins/`、`locales/`、`styles/`:本專案用了 vue-i18n 與 Vuetify,需要這些資料夾。
- `composables/`:Vue 3 慣例的 composable 目錄。
- `__tests__/`:單元測試放在被測層級底下(`services/__tests__/`、`utils/__tests__/`、`stores/__tests__/`、`router/__tests__/`、`components/__tests__/`、`plugins/__tests__/`),橫跨多層的才放 `src/__tests__/`。`tsconfig.app.json` 排除、`tsconfig.vitest.json` 納入。
- `test/`:`setup.ts`、`testUtils.ts` 這類測試共用工具,獨立於 `__tests__/`,避免被當成測試檔;同樣由 `tsconfig.app.json` 排除、`tsconfig.vitest.json` 納入。`tsconfig.vitest.json` 的 `types` 含 `jsdom`,對應的型別由 devDependency `@types/jsdom` 提供,版本與 `jsdom` 主版號保持一致。

### 調整時機與做法

- **時機**:放在所有設定檔之後(設定已用寬範圍 glob 與單一 `@` alias,搬資料夾幾乎不必改設定),且在測試、Git hooks 與應用程式碼之前,避免寫完再搬等於重做。放到最末端才調整,測試與程式碼都得重做。
- **做法**:先定好目錄再一次搬完,但別一次動太多,出錯難定位;邊搬邊跑型別檢查,及早發現路徑錯誤。

### 擴充時的建議

- 新增檔案前先確認它屬於哪個資料夾,規則見上表。
- 如果同一個功能(例如聊天室)的檔案開始散落在 `components/`、`api/`、`stores/`、`composables/` 多處、難以維護,再考慮改成 `features/<功能>/` 的功能模組結構。
