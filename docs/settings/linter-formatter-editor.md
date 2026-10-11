# 程式碼品質工具設定檔：Linter、Formatter、editor

依工具性質分為三類:

| 分類      | 檔案                                                      | 負責的事                       |
| --------- | --------------------------------------------------------- | ------------------------------ |
| Linter    | `eslint.config.ts`、`.oxlintrc.json`、`.stylelintrc.json` | 找出潛在錯誤與不良寫法         |
| Formatter | `.prettierrc.json`                                        | 統一程式碼排版(引號、分號等)   |
| 編輯器    | `.editorconfig`                                           | 讓不同編輯器套用相同的基本格式 |

`npm run lint` 的執行順序為 oxlint → eslint → stylelint;Prettier 由 `npm run format` 與 lint-staged 另外執行。

## Linter

### eslint.config.ts

由上往下是「檢查範圍」、「忽略範圍」、「規則集」、「測試檔規則」、「與 oxlint 去重」、「關閉排版規則」六個區塊,後面的設定可覆蓋前面的。

#### 設定語法對應效果

| 設定                                                                     | 效果                                                |
| ------------------------------------------------------------------------ | --------------------------------------------------- |
| `defineConfigWithVueTs(...)`                                             | 讓 Vue 檔的 `<script lang="ts">` 也能用 TS 規則檢查 |
| `files: ['**/*.{vue,ts,mts,tsx}']`                                       | 只檢查 Vue 與 TS 檔                                 |
| `globalIgnores(['**/dist/**', '**/dist-ssr/**', '**/coverage/**'])`      | 不檢查建置產物與覆蓋率報告                          |
| `...pluginVue.configs['flat/essential']`                                 | 套用 Vue 最基本的規則(會導致錯誤的寫法)             |
| `vueTsConfigs.recommended`                                               | 套用 typescript-eslint 的建議規則                   |
| `{ ...pluginVitest.configs.recommended, files: ['src/**/__tests__/*'] }` | Vitest 規則只套用在測試檔                           |
| `...pluginOxlint.buildFromOxlintConfigFile('.oxlintrc.json')`            | 讀取 oxlint 設定,關閉 ESLint 中與 oxlint 重複的規則 |
| `skipFormatting`(`eslint-config-prettier/flat`)                          | 關閉所有與 Prettier 衝突的排版規則                  |

#### 應避免的錯誤

- `pluginOxlint` 或 `skipFormatting` 放在規則集之前,後面的規則集會把關閉的規則重新打開,導致重複報錯或與 Prettier 衝突。
- Vitest 規則不限定 `files`,一般程式碼也會被套用測試專用規則。
- 若沒有 `globalIgnores`,會掃描 `dist`、`coverage` 內的產出檔並產生無法修正的錯誤。

### .oxlintrc.json

oxlint 是用 Rust 寫的高速 linter,負責先跑一輪最基本的檢查,ESLint 再處理其餘規則。

#### 設定語法對應效果

| 設定                                                                   | 效果                                       |
| ---------------------------------------------------------------------- | ------------------------------------------ |
| `$schema`                                                              | 編輯器提供欄位提示與驗證                   |
| `plugins: ["eslint", "typescript", "unicorn", "oxc", "vue", "vitest"]` | 啟用對應的規則來源                         |
| `env: { browser: true }`                                               | 認得 `window`、`document` 等瀏覽器全域變數 |
| `categories: { correctness: "error" }`                                 | 只開啟「確定有問題」類的規則,違反即報錯    |

#### 應避免的錯誤

- 若沒有 `env.browser`,瀏覽器全域變數將會被報成未定義。
- 在這裡新增規則後,沒有重跑 ESLint,`buildFromOxlintConfigFile` 才會同步關掉重複規則;兩邊規則來源要保持一致。

### .stylelintrc.json

分為「基底規則」、「.vue 檔覆寫」、「自訂規則」、「忽略範圍」四個區域。

#### 基底規則

##### 設定語法對應效果

| 設定                                          | 效果                     |
| --------------------------------------------- | ------------------------ |
| `extends: ["stylelint-config-standard-scss"]` | 以 SCSS 版標準規則為基底 |

##### 應避免的錯誤

- 改用不含 SCSS 的基底規則,SCSS 語法會被誤判。

#### .vue 檔覆寫

##### 設定語法對應效果

| 設定                                                 | 效果                              |
| ---------------------------------------------------- | --------------------------------- |
| `files: ["**/*.vue"]`                                | 只對 Vue 單一檔案元件套用         |
| `customSyntax: "postcss-html"`                       | 能解析 `.vue` 內的 `<style>` 區塊 |
| `extends: ["stylelint-config-recommended-vue/scss"]` | 套用 Vue 的 SCSS 建議規則         |
| `"no-empty-source": null`                            | 沒有樣式的 `.vue` 檔不會被報錯    |

##### 應避免的錯誤

- 沒指定 `postcss-html`,`.vue` 內的樣式無法解析。
- 保留 `no-empty-source`,只有 `<template>`、`<script>` 的元件會被判為空來源而報錯。

#### 自訂規則

##### 設定語法對應效果

| 設定                                                                            | 效果                                        |
| ------------------------------------------------------------------------------- | ------------------------------------------- |
| `selector-pseudo-class-no-unknown` 的 `ignorePseudoClasses: ["deep", "global"]` | `:deep()`、`:global()` 不被當成未知的偽類別 |
| `"scss/at-rule-no-unknown": null`                                               | 關閉 at-rule 是否未知的檢查                 |

##### 應避免的錯誤

- 移除 `deep`、`global` 的例外,Vue 的 `:deep()`、`:global()` 會被報錯。

#### 忽略範圍

##### 設定語法對應效果

| 設定                                                         | 效果                                   |
| ------------------------------------------------------------ | -------------------------------------- |
| `ignoreFiles: ["dist/**", "coverage/**", "node_modules/**"]` | 不檢查建置產物、覆蓋率報告與第三方套件 |

##### 應避免的錯誤

- 沒排除這些資料夾,會掃描大量非原始碼檔案,且產生無法修正的錯誤。

## Formatter

### .prettierrc.json

Prettier 只管排版,不檢查程式邏輯;與 ESLint 的分工靠 `eslint-config-prettier` 銜接。

#### 設定語法對應效果

| 設定                | 效果                     |
| ------------------- | ------------------------ |
| `$schema`           | 編輯器提供欄位提示與驗證 |
| `semi: false`       | 句尾不加分號             |
| `singleQuote: true` | 字串使用單引號           |
| `printWidth: 100`   | 超過 100 字元自動換行    |

#### 應避免的錯誤

- `printWidth` 與 `.editorconfig` 的 `max_line_length` 數字不一致,編輯器提示與實際排版結果會對不上。
- 在 ESLint 裡另外開排版類規則(如 `semi`、`quotes`),會和 Prettier 互相打架;排版統一交給 Prettier。

## 編輯器

### .editorconfig

不是 lint 工具,而是編輯器層級的基本設定,在輸入階段就先統一格式。

#### 設定語法對應效果

| 設定                                                              | 效果                              |
| ----------------------------------------------------------------- | --------------------------------- |
| `[*.{js,jsx,mjs,cjs,ts,tsx,mts,cts,vue,css,scss,sass,less,styl}]` | 只對這些程式碼與樣式檔套用        |
| `charset = utf-8`                                                 | 檔案編碼統一為 UTF-8              |
| `indent_style = space`、`indent_size = 2`                         | 以 2 個空格縮排                   |
| `insert_final_newline = true`                                     | 檔案結尾補一個換行                |
| `trim_trailing_whitespace = true`                                 | 自動刪除行尾多餘空白              |
| `end_of_line = lf`                                                | 換行符號統一為 LF(Windows 也一致) |
| `max_line_length = 100`                                           | 編輯器的行寬提示為 100            |

#### 應避免的錯誤

- 沒統一 `end_of_line = lf`,Windows 預設的 CRLF 會讓 diff 全檔變動。
- 副檔名範圍漏掉 `.vue` 或樣式檔,這些檔案的縮排會各自為政。

## 共通注意事項

### glob 比對範圍

#### 設定語法對應效果

| 寫法                                 | 效果                         |
| ------------------------------------ | ---------------------------- |
| `src/**/*`、`**/*.{ts,vue}` 等寬範圍 | 之後調整專案結構不必重改設定 |

#### 應避免的錯誤

- glob 指定到個別資料夾,調整專案結構時就得重改。

### 自動修正流程

#### 設定語法對應效果

| 動作                                            | 效果                 |
| ----------------------------------------------- | -------------------- |
| 改完先跑全專案 `npm run lint`、`npm run format` | 一次套用自動修正     |
| 修正結果獨立成一個 commit                       | 不和邏輯修改混在一起 |
| 驗收 `npm run lint`                             | 沒有錯誤             |

#### 應避免的錯誤

- 自動修正的結果與邏輯修改混在同一個 commit。
