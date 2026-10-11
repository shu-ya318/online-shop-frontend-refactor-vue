# Docker 設定：Dockerfile 與 .dockerignore

## Dockerfile

多階段建置(build → nginx)

### 設定語法對應效果

| 設定                   | 效果                                        |
| ---------------------- | ------------------------------------------- |
| Node 版本與第 0 步一致 | 建置環境與本機一致                          |
| 用 `npm ci` 安裝       | 依鎖定檔安裝                                |
| build → nginx 多階段   | 驗收:`docker build` 成功,容器啟動後能開頁面 |

### 應避免的錯誤

- Node 版本與 package.json 的版號不一致。
- 安裝改用 `npm install` 而非 `npm ci`。

## .dockerignore

分為「排除清單」與「例外保留」兩個區域,作用是縮小 build context、避免把本機環境變數帶進映像檔。

### 排除清單

#### 設定語法對應效果

| 排除項目                                                              | 效果                                                           |
| --------------------------------------------------------------------- | -------------------------------------------------------------- |
| `node_modules`、`dist`、`.git`、`.husky`、`.vscode`、`.idea`          | 不把相依套件、建置產物、版本控制與編輯器設定送進 build context |
| `coverage`、`test-results`、`playwright-report`、`blob-report`、`e2e` | 測試產物與 e2e 測試不進映像檔                                  |
| `docs`、`README.md`、`Dockerfile*`、`.dockerignore`、`*.log`          | 文件、建置檔本身與記錄檔不進映像檔                             |
| `.env`、`.env.*`、`env/.env`、`env/.env.*`、`.npmrc-nexus`            | 本機環境變數與內網 registry 設定不進映像檔                     |

#### 應避免的錯誤

- 沒排除 `.env*`,本機環境變數會被帶進映像檔。
- 沒排除 `node_modules`,build context 變大,建置變慢。

### 例外保留

#### 設定語法對應效果

| 設定                | 效果                                                  |
| ------------------- | ----------------------------------------------------- |
| `!env/.env.example` | 範本檔仍保留在 build context(其餘 `env/.env*` 都排除) |

#### 應避免的錯誤

- 例外規則放在排除規則之前:`!` 規則必須寫在被它覆蓋的規則之後才有效。
