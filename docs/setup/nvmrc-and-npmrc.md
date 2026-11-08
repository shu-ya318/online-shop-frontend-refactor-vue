# .nvmrc 與 .npmrc

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
