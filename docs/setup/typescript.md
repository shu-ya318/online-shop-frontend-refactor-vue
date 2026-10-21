# TypeScript 設定檔：tsconfig.json、tsconfig.app.json、tsconfig.node.json、tsconfig.vitest.json 說明

`npm run type-check`(`vue-tsc --build`)依下列順序執行:

1. **tsconfig.json:** 入口檔,自己不檢查任何檔案,只用 `references` 串起另外三份設定。
2. **tsconfig.node.json:** 檢查跑在 Node 的設定檔(`vite.config.*`、`vitest.config.*`、`playwright.config.*`、`eslint.config.*`)。
3. **tsconfig.app.json:** 檢查瀏覽器端的應用程式碼(`src/`),是最主要的一份。
4. **tsconfig.vitest.json:** 檢查單元測試(`src/**/__tests__/`)與測試共用工具(`src/test/`),繼承 app 設定再補上測試所需的型別。

## tsconfig.json

| 設定          | 效果                                                   |
| ------------- | ------------------------------------------------------ |
| `"files": []` | 入口本身不含任何檔案,避免與下面三份重複檢查            |
| `references`  | 列出 node、app、vitest 三份設定,`--build` 各自獨立檢查 |

## tsconfig.node.json

| 設定                                                | 效果                                                  |
| --------------------------------------------------- | ----------------------------------------------------- |
| `extends: "@tsconfig/node24/tsconfig.json"`         | 以 Node 24 的建議設定為基底                           |
| `include`                                           | 只涵蓋各工具的設定檔,不含 `src/`                      |
| `module: "preserve"`、`moduleResolution: "bundler"` | 沿用打包工具的解析方式,與 Vite 行為一致               |
| `allowImportingTsExtensions: true`                  | 允許 `import './x.ts'` 帶副檔名                       |
| `types: ["node"]`                                   | 只載入 Node 型別,避免誤引入其他 `@types/*`            |
| `noEmit: true`                                      | 只做型別檢查,不輸出檔案                               |
| `tsBuildInfoFile`                                   | 增量檢查的快取檔放進 `node_modules/.tmp`,不污染根目錄 |

## tsconfig.app.json

| 設定                                                    | 效果                                                               |
| ------------------------------------------------------- | ------------------------------------------------------------------ |
| `extends: "@vue/tsconfig/tsconfig.dom.json"`            | 以 Vue 官方的瀏覽器端設定為基底(含 DOM 型別)                       |
| `include: ["env/env.d.ts", "src/**/*", "src/**/*.vue"]` | 寬鬆範圍,不綁特定資料夾,調整結構時不必再改;`.vue` 需另外列出       |
| `exclude: ["src/**/__tests__/*", "src/test/**/*"]`      | 測試檔交給 vitest 那份設定,不混進應用程式的檢查                    |
| `strict: true`                                          | 嚴格模式明寫在設定檔                                               |
| `noUncheckedIndexedAccess`                              | 以索引取陣列、物件的值時,型別含 `undefined`,強制檢查               |
| `noUnusedLocals`、`noUnusedParameters`                  | 未使用的變數、參數視為錯誤                                         |
| `erasableSyntaxOnly`                                    | 禁用 `enum`、`namespace` 等無法直接抹除的語法,相容 Node 的型別剝除 |
| `noFallthroughCasesInSwitch`                            | `switch` 的 case 漏寫 `break` 時報錯                               |
| `paths: { "@/*": ["./src/*"] }`                         | 只留一條,與 vite 的 `resolve.alias` `'@'` 對應                     |
| `tsBuildInfoFile`                                       | 同 node,快取檔放進 `node_modules/.tmp`                             |

### 應避免的錯誤

- 錯誤1：`compilerOptions` 裡未寫 `strict`
  - TypeScript 6 起 strict 預設開啟，本專案是嚴格模式但設定檔卻未註明。
- 後果
  - 讀設定的人以為沒開;之後如果改成繼承別的 base 設定、或換了 TypeScript 版本,嚴格檢查可能被關掉。

- 錯誤2：`paths` 與 vite 的 alias 各寫一份
  - 每個資料夾各寫一條 alias 與 paths,同一件事寫在兩處。
- 後果
  - 新增資料夾要改兩次,漏改一邊就會出現「Vite 能跑、型別檢查卻報找不到模組」(或相反)。

## tsconfig.vitest.json

| 設定                                                               | 效果                                                              |
| ------------------------------------------------------------------ | ----------------------------------------------------------------- |
| `extends: "./tsconfig.app.json"`                                   | 繼承 app 設定,alias、嚴格模式只需維護一份                         |
| `include: ["src/**/__tests__/*", "src/test/**/*", "env/env.d.ts"]` | 只檢查測試檔與測試共用工具                                        |
| `exclude: []`                                                      | 清空繼承來的 `exclude`;否則 app 排除了測試檔,這裡就什麼都檢查不到 |
| `lib: ["ES2022"]`                                                  | 指定測試可用的標準函式庫                                          |
| `types: ["node", "jsdom"]`                                         | 載入 Node 與 jsdom 型別                                           |
| `tsBuildInfoFile`                                                  | 快取檔放進 `node_modules/.tmp`                                    |

### 應避免的錯誤

- 錯誤1：在 vitest 的 tsconfig 另寫一份 `paths`
  - 繼承 app 已經有 `paths`,卻又重寫一份。
- 後果
  - 兩份 `paths` 日後再次不同步。

- 錯誤2：繼承 app 後沒有清空 `exclude`
  - app 的 `exclude` 會一併被繼承,把測試檔排除掉。
- 後果
  - 測試檔沒有被型別檢查,錯誤要到執行測試時才發現。
