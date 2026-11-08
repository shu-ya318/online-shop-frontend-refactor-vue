# vitest.config.ts

- Vitest 的設定檔，用來定義、客製化單元測試的運作行為，讓測試在任何機器上跑出一樣的結果。
- **與 `vite.config.ts` 的關係**:
  - 沒有 `vitest.config.ts` 時，Vitest 會直接讀 `vite.config.ts`;有 `vitest.config.ts` 時以它為準，不再自動讀 `vite.config.ts`。
  - 若使用 `mergeConfig` 合併兩者，測試會沿用 plugins、alias，再加上 `test` 設定。
- **`test` 區塊控制的事**:
  - 執行環境(`jsdom` 或 Node)、哪些檔案算測試檔(`exclude`)、測試前先載入的檔案(`setupFiles`)、時區(`env.TZ`)、套件的處理方式(`server.deps.inline`)。
- 本文依檔案由上到下分為「寫法(mergeConfig)」、「執行環境」、「測試檔位置」、「setupFiles」、「root」、「時區」、「server.deps.inline」七個區域。

## 寫法(mergeConfig)

### 設定語法對應效果

| 設定                                                                                             | 效果                                                                                |
| ------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------- |
| `mergeConfig(viteConfig, defineConfig({ test: { ... } }))`(或 `defineConfig({ test: { ... } })`) | 前者沿用 `vite.config.ts` 的 plugins、alias 再加上 `test`;後者不讀 `vite.config.ts` |
| `import viteConfig from './vite.config.ts'`                                                      | 搭配 `mergeConfig` 使用，取得 Vite 設定                                             |
| `import { mergeConfig, defineConfig, configDefaults } from 'vitest/config'`                      | 從 `vitest/config` 匯入，`defineConfig` 才有 `test` 欄位的型別提示                  |

### 應避免的錯誤

- 用獨立的 `defineConfig` 卻沒有自己補 `resolve.alias`:測試檔裡的 `@/` 匯入解析不到。
- `vite.config.ts` 改成函式寫法(`({ mode }) => ...`)後仍直接傳給 `mergeConfig`:執行時報 `Cannot merge config in form of callback`;要先呼叫該函式取得設定物件再合併。

## 執行環境

### 設定語法對應效果

| 設定                                       | 效果                                    |
| ------------------------------------------ | --------------------------------------- |
| `environment: 'jsdom'`                     | 元件測試有 DOM,並可掛載 Vuetify         |
| 測試檔第一行 `// @vitest-environment node` | services、utils 測試改用 Node 環境,較快 |

### 應避免的錯誤

- services、utils 這類不需要 DOM 的測試仍使用 jsdom,執行較慢。

## 測試檔位置

### 設定語法對應效果

| 設定                                                                           | 效果                                                        |
| ------------------------------------------------------------------------------ | ----------------------------------------------------------- |
| `exclude: [...configDefaults.exclude, 'e2e/**']`                               | 保留 Vitest 預設排除項目，再排除 `e2e/`,e2e 交給 Playwright |
| 不寫 `include`                                                                 | 依預設只收集檔名為 `*.spec.*`、`*.test.*` 的檔案            |
| 單元測試放在被測層級的 `__tests__/`(如 `services/__tests__/`),檔名 `*.spec.ts` | 測試與被測層級相鄰,好找也不撞名                             |
| 共用工具 `setup.ts`、`testUtils.ts` 放 `src/test/`                             | 工具與測試檔分開，不混在 `__tests__/`                       |

### 應避免的錯誤

- 測試路徑與調整後的專案結構不一致。
- `exclude` 直接寫 `['e2e/**']` 沒展開 `configDefaults.exclude`:預設排除的 `node_modules` 等會被覆蓋掉，套件內的測試檔也被收集。

## setupFiles

### 設定語法對應效果

| 設定                                                                     | 效果                                                                                                   |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------ |
| `setupFiles: ['./src/test/setup.ts']`(或 `['./src/__tests__/setup.ts']`) | 每個測試檔執行前先載入，補上 jsdom 沒有的 `ResizeObserver`、`matchMedia`、`visualViewport`、`scrollTo` |

### 應避免的錯誤

- 沒補 `ResizeObserver`、`matchMedia`:Vuetify 元件測試會出錯。
- 沒補 `visualViewport`:`v-menu` 等 overlay 元件定位時讀不到。
- 沒補 `scrollTo`:vue-router 換頁時呼叫 `scrollTo`,jsdom 印出 `Not implemented`。

## root

### 設定語法對應效果

| 設定                                                  | 效果                                                       |
| ----------------------------------------------------- | ---------------------------------------------------------- |
| `root: fileURLToPath(new URL('./', import.meta.url))` | 以設定檔所在目錄(專案根目錄)為測試根目錄，不受執行目錄影響 |

### 應避免的錯誤

- `root` 寫成相對字串(如 `'./'`):會以執行指令時的目錄為準，不一定是專案根目錄。

## 時區

### 設定語法對應效果

| 設定                         | 效果                                      |
| ---------------------------- | ----------------------------------------- |
| `env: { TZ: 'Asia/Taipei' }` | 固定時區,日期相關測試在任何機器上結果一致 |

### 應避免的錯誤

- 不固定時區,日期相關測試的結果會因機器而異。

## server.deps.inline

### 設定語法對應效果

| 設定                                                 | 效果                                                                 |
| ---------------------------------------------------- | -------------------------------------------------------------------- |
| 不寫(或 `server: { deps: { inline: ['vuetify'] } }`) | 讓 `vuetify` 經過 Vite 轉換再執行，套件內匯入的 CSS 等檔案才處理得了 |

### 應避免的錯誤

- 使用 Vuetify 卻沒把 `vuetify` 加進 `inline`:Vitest 預設把 `node_modules` 交給 Node 直接執行，遇到 Vuetify 匯入的 `.css` 會報錯，元件測試無法載入。
