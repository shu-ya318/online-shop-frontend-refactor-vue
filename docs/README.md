# 文件索引

依重構順序排列。

| 資料夾          | 內容                                                                                           | 順序 |
| --------------- | ---------------------------------------------------------------------------------------------- | ---- |
| `setup/`        | 入口檔與各設定檔:package.json、TypeScript、Vite、linter/formatter、main.ts、index.html         | ①    |
| `architecture/` | 專案結構、各類檔案語法、資料層(request-flow、error-handling、socket)、路由(router-flow)、utils | ②    |
| `testing/`      | 測試通則、Vitest、Playwright                                                                   | ③    |
| `repo/`         | 環境變數、.gitignore、.gitattributes、Git hooks                                                | ④    |
| `deploy/`       | Docker、nginx                                                                                  | ⑤    |
| `guides/`       | 跨專案通用指引:React 轉 Vue 重構指引、Vue 程式碼規範 `vue-conventions.md`(不屬於重構步驟)      | —    |

新增文件時,先依上表決定資料夾;同資料夾內的連結用 `./xxx.md`,跨資料夾用 `../資料夾/xxx.md`。
