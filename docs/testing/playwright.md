# playwright.config.ts

- Playwright(E2E 端對端測試工具)的設定檔，控制整個自動化測試專案在執行時的全域行為與環境參數。
- 本文會先說明前置作業，再依檔案由上到下分為「測試檔位置與執行方式」、「use」、「projects」、「webServer」四個區域。

## e2e 測試

### 設定語法對應效果

| 動作                                   | 效果                                                                     |
| -------------------------------------- | ------------------------------------------------------------------------ |
| 執行 `npx playwright install`          | 下載 Playwright 內建的瀏覽器(project 用 `chromium` 時需要)               |
| 本機安裝 Google Chrome、Microsoft Edge | project 用 `channel: 'chrome'`、`channel: 'msedge'` 時直接使用本機瀏覽器 |
| 跑通 `test:e2e`                        | 驗收標準                                                                 |
| e2e 檔案放 `e2e/**`(被 Vitest 排除)    | 單元測試與 e2e 分工                                                      |

### 應避免的錯誤

- 把 e2e 檔案納入 Vitest 的執行範圍(`e2e/**` 應被排除)。
- project 使用 `channel` 但本機沒裝對應瀏覽器:`test:e2e` 會同時跑所有 project,缺任一個就失敗;只裝其中一個時改用 `--project=chrome` 或 `--project=edge`。

## 測試檔位置與執行方式

### 設定語法對應效果

| 設定                              | 效果                                                 |
| --------------------------------- | ---------------------------------------------------- |
| `testDir: './e2e'`                | 只從 `e2e/` 收集測試                                 |
| `fullyParallel: true`             | 同個檔案內的測試也平行執行                           |
| `forbidOnly: !!process.env.CI`    | CI 上遺留 `test.only` 時直接失敗，避免只跑到部分測試 |
| `retries: process.env.CI ? 2 : 0` | CI 失敗時最多重試 2 次;本機不重試                    |
| `reporter: 'html'`                | 產出 HTML 報告(`playwright-report/`)                 |

### 應避免的錯誤

- 本機也開重試:不穩定的測試會被重試蓋過，本機看不出問題。

## use

### 設定語法對應效果

| 設定                                                             | 效果                                                      |
| ---------------------------------------------------------------- | --------------------------------------------------------- |
| `baseURL: 'http://localhost:4173'`(或 `'http://127.0.0.1:4173'`) | 測試內 `page.goto('/')` 以此為基準;`4173` 是 preview 埠號 |
| `trace: 'on-first-retry'`                                        | 第一次重試時才錄 trace;本機 `retries` 為 0,只有 CI 會錄   |

### 應避免的錯誤

- `baseURL` 與 `webServer.url` 的主機或埠號不一致:Playwright 等的伺服器和測試實際連的不是同一個。

## projects

### 設定語法對應效果

| 設定                                                                           | 效果                                                   |
| ------------------------------------------------------------------------------ | ------------------------------------------------------ |
| `{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }`                  | 使用 Playwright 下載的 Chromium                        |
| `{ name: 'chrome', use: { ...devices['Desktop Chrome'], channel: 'chrome' } }` | 使用本機安裝的 Google Chrome                           |
| `{ name: 'edge', use: { ...devices['Desktop Edge'], channel: 'msedge' } }`     | 使用本機安裝的 Microsoft Edge                          |
| `playwright test --project=chrome`(或 `--project=edge`)                        | 只跑指定的 project(`test:e2e:chrome`、`test:e2e:edge`) |

### 應避免的錯誤

- 用 `chromium` 卻沒執行 `npx playwright install`:找不到瀏覽器，測試無法啟動。

## webServer

### 設定語法對應效果

| 設定                                                                                                | 效果                                                                  |
| --------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| `command: 'npm run build && npm run preview'`(或 `'npm run build-only:dev && npm run preview:dev'`) | 測試前自動打包並啟動 preview;後者只打包不跑 type-check,降低記憶體消耗 |
| `url: 'http://localhost:4173'`(或 `'http://127.0.0.1:4173'`)                                        | 等到此網址有回應才開始測試                                            |
| `reuseExistingServer: !process.env.CI`                                                              | 4173 已有服務時：本機直接沿用;CI 判定失敗                             |
| 不寫 `timeout`(或 `timeout: 180_000`)                                                               | 等待伺服器啟動的上限;打包加啟動較久時延長到 180 秒                    |

### 應避免的錯誤

- 本機 4173 還開著舊的 preview:測試會沿用舊服務，跑到的不是最新程式碼;先關閉舊的 preview 再測。
- 用 `build-only` 跳過 type-check:型別錯誤不會在 E2E 時被擋下，需由 pre-push 或 CI 的 type-check 負責。
