# CLAUDE.md

## 專案概述

lookGo 前端:捷運地圖查詢、站點收藏、站內聊天室、行程規劃的 Web 應用(含管理員頁面)。原本為 React 為主撰寫，本專案重構成 Vue 版本。

- Vue 3.5 + TypeScript(strict、`noUncheckedIndexedAccess`、`erasableSyntaxOnly`)
- Vite 8、npm(有 `package-lock.json`)、Node `>=24.21 <25`
- UI:Vuetify 3(`vite-plugin-vuetify` 自動 import 元件,樣式覆寫在 `src/styles/settings.scss`)
- 路由 Vue Router 4;狀態 Pinia(setup store 寫法)
- i18n vue-i18n(`src/locales/` en、zh-TW)
- HTTP:axios;即時聊天:STOMP over WebSocket(`@stomp/stompjs`);驗證:zod
- 其他依賴:富文字 tiptap、PDF 匯出 jspdf、日期 date-fns(+`@date-fns/tz`)、數值 decimal.js、工具 lodash-es、JWT 解碼 jwt-decode、身分證驗證 taiwan-id-validator
- 工具鏈:lint 用 oxlint + eslint + stylelint,格式化 prettier,測試 Vitest 4 + Playwright,husky + lint-staged
- 後端:Spring(本機 `localhost:8082`),API 前綴 `/api/v1`,WebSocket `/ws`
- 容器化部署:Docker + nginx 反向代理(`nginx/`),前後端同源

## 回應規範

- 一律使用繁體中文及台灣軟體業常見用語

## 重要文件 (待改，並標示甚麼情形載入)

- docs/architecture/project-structure.md:目錄結構與 `api/`、`services/` 分工
- docs/architecture/request-flow.md:HTTP 請求流程(依階段)、token、401 處理
- docs/architecture/error-handling.md:`ApiError` 與錯誤解析
- docs/testing/testing.md:測試寫法
- Vue 程式碼規範(篇幅長,不要預先載入):`docs/guides/vue-conventions.md`。僅在撰寫/審查元件、composable、store、路由時,依章節(命名、SFC、模板、Composition API 等)用 Grep 或指定行數讀取相關段落,勿整份讀入
- 其他(按需查閱):`docs/architecture/`(router-flow、store、socket、utils)、`docs/setup/`、`docs/testing/`(vitest、playwright)、`docs/repo/`、`docs/deploy/`、`docs/guides/react-to-vue-migration-guide.md`(React 轉 Vue 重構指引);索引見 `docs/README.md`(資料夾依重構順序 setup → architecture → testing → repo → deploy)

## 文件撰寫規範(docs/setup/)

- 新增或修改 `docs/setup/` 的設定檔說明前,先讀 @docs/writing-guide.md,並以 `docs/setup/index-html.md` 為範本
- 結構:H1 檔名 + 1~2 句總覽 → H2 依檔案由上到下分區 → 每區固定 H3「設定語法對應效果」(表格)+「應避免的錯誤」
- 錯誤條目:錯誤N(全文連號)→ 現象 → 後果 → Vue 版做法,缺一不可
- 敘述精簡,一句一個重點,內容要能口述給新手工程師聽
- 只寫讀過原始檔後確認的事實;不確定的標「待確認」並詢問,不要補全
- `docs/setup/index.md` 為總覽筆記,不套用此規範;其他資料夾暫不受此規範約束

## 開發指令

- 安裝:`npm install`
- 開發:`npm run dev`(Vite proxy 把 `/api/v1`、`/ws` 轉到 `localhost:8082`)
- 建構:`npm run build`(`run-p` 平行執行 `type-check` 與 `build-only`(`vite build`);預覽:`npm run preview`)
- 型別檢查:`npm run type-check`(`vue-tsc --build`)
- Lint:`npm run lint`(oxlint → eslint → stylelint,皆帶 `--fix`)
- 格式化:`npm run format`(prettier)
- 單元測試:`npm run test:unit`;watch:`npm run test:unit:watch`
- 單一檔案:`npx vitest run src/services/__tests__/errors.spec.ts`
- E2E:`npm run test:e2e`(Playwright,檔案在 `e2e/`)
- pre-commit 由 husky 執行 `lint-staged`(eslint、stylelint、prettier)

## 程式碼慣例

- 路徑別名 `@` 指向 `src`,不寫絕對路徑 `../../`
- 命名規範：元件檔 PascalCase(`UserProfileMenu.vue`),頁面以 `Page` 結尾(`LoginPage.vue`);其餘 `.ts` 檔 camelCase
- Store 檔名為領域名(`stores/auth.ts`),匯出 `useXxxStore`,用 setup 寫法
- composable 放 `composables/`;全域通知用 `notify.success/error/warning/info`(`composables/notify.ts`)
- 禁止 `any`;型別斷言(`as`)盡量避免,尤其不要 `as unknown as`
- 單元測試放在被測層級的 `__tests__/` 下(`services/__tests__/`、`utils/__tests__/`、`stores/__tests__/`、`router/__tests__/`、`components/__tests__/`、`plugins/__tests__/`),橫跨多層的放 `src/__tests__/`,檔名 `*.spec.ts`;共用工具(`setup.ts`、`testUtils.ts`)放 `src/test/`(tsconfig.app 排除、tsconfig.vitest 納入)
- services / utils 的測試檔首行加 `// @vitest-environment node`;元件測試預設 jsdom
- 目錄:`views/` 頁面(依領域分子資料夾)、`components/` 共用元件、`layouts/`、`router/`、`stores/`、`services/`、`utils/`、`constants/`、`plugins/`

## 架構

- 所有 HTTP 一律經 `src/services/http.ts` 的 `post<T>()`,禁止在元件或 store 直接用 axios/fetch
- 各領域 service:`services/<領域>/index.ts`(API 函式)+ `interface.ts`(request/response 型別);WebSocket 在 `services/stationChat/socket.ts`
- 錯誤:所有失敗統一轉成 `ApiError`(`kind`、`status`、`message`、`fieldErrors`、`cause`),由 `services/errors.ts` 負責,不做導頁等副作用;訊息已是可顯示的繁中。呼叫端用 `isApiError` / `getErrorMessage`
- Token:access token 只存記憶體,由 `services/tokenManager.ts` 管理(快過期判斷、single-flight 刷新、用獨立 `refreshClient` 避免循環依賴);refresh token 走 cookie;`stores/auth.ts` 把狀態同步成 Pinia
- 登入失效流程:tokenManager 觸發 `setOnAuthExpired` → `router/authExpired.ts` 重置 user-scoped stores、提示、必要時導到 `login?redirect=`
- 與使用者綁定的 store 用 `userScoped` 選項(`stores/plugins/userScoped.ts`),登出/失效時會被 `resetUserScopedStores` 一併重置
- 路由:`routes.ts` 以 `meta.requiresAuth` / `meta.requiresAdmin` 控管,守衛在 `router/guards.ts`
- 後端回傳時間為「無時區標示的 UTC」,一律用 `utils/date.ts` 的 `formatDateTime` 轉台北時間
- 全域錯誤由 `plugins/errorHandling.ts` 捕捉

## 關鍵決策

- `ApiError` 不再讀舊的 `data.error.message` / `data.files`;若後端端點仍用這些格式,需對照 `GlobalExceptionHandler` 再補
- `api/` 暫不拆,HTTP 與 WebSocket 都放 `services/`,待 services 複雜再拆

## 測試

- 框架:Vitest(jsdom)+ `@vue/test-utils` / `@testing-library/vue`;`src/test/setup.ts` 已 stub `ResizeObserver`、`matchMedia`(Vuetify 需要),共用工具在 `src/test/testUtils.ts`
- 時區固定為 `Asia/Taipei`(`vitest.config.ts`),日期測試不要依賴本機時區
- vuetify 需 `server.deps.inline`,新增 UI 測試遇到 Vuetify 載入錯誤先查 `vitest.config.ts`
- 規則:新 service / util / store 需對應 spec;改 token、錯誤處理邏輯時必跑 `http.spec.ts`、`tokenManager.spec.ts`、`errors.spec.ts`
- 通過標準:`npm run lint`、`npm run type-check`、`npm run test:unit` 全綠

## 常見任務

### 新增頁面

1. 在 `src/views/<領域>/` 建立 `XxxPage.vue`(參考 `views/auth/LoginPage.vue`)
2. 在 `src/router/routes.ts` 加路由,需登入/管理員就設 `meta`
3. 需要導覽入口必須改 `layouts/navItems.ts`
4. 文案放 `src/locales/` 兩份語系檔，包含繁體中文、英文。
5. 寫對應測試檔,放在對應層級的 `__tests__/`(頁面測試放 `views/__tests__/`)

### 新增 API 串接

1. 在 `src/services/<領域>/interface.ts` 定義型別,`index.ts` 用 `post<T>()` 實作(參考 `services/user/`)
2. 需要資料共享就加/改 `stores/` 對應 store;與使用者綁定的 store 加 `userScoped`
3. 補 mock 測試

## 常見地雷

- 環境變數放 `env/`(非根目錄),複製 `env/.env.example` 為 `env/.env.local`;只有 `VITE_` 開頭會暴露給前端,且 build 時就寫死,不放機密
- `VITE_API_BASE_URL` 預設 `/api/v1`;跨網域部署時後端 CORS 要含前端網址且必須 HTTPS,refresh cookie 才送得出去
- 登入密碼錯誤的 401 不可觸發 token 刷新(`NO_REFRESH_ON_401`),改 `http.ts` 時別破壞
- `package.json` 依賴版本為精確版本(無 `^`),升級需逐一確認
- 部分舊文件(如 `project-structure.md`)仍寫 `authStore` 等舊檔名,實際以 `src/stores/` 現況為準(`auth.ts`、`user.ts`、`metroMap.ts`、`station.ts`、`stationBookmark.ts`)
- `package.json` 有 `keycloak-js`,但 `src/` 目前未使用;勿假設登入走 Keycloak

# 禁止事項

- 不確定的資訊請先詢問，避免憑空捏造、自行補全
- 改動程式碼若影響行為，必須指出要同步更新對應的 docs
