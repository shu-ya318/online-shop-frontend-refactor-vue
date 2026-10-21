# main.ts(src/)

應用程式入口(`src/main.ts`)。依檔案由上到下分為「建立 app 與 Pinia」、「外掛註冊順序」、「掛載」三個區域。掛載點為 `index.html` 的 `#app`。

## 建立 app 與 Pinia

### 設定語法對應效果

| 設定                                | 效果                                                       |
| ----------------------------------- | ---------------------------------------------------------- |
| `createApp(App)`                    | 以根元件 `App.vue` 建立 Vue 應用程式實例                   |
| `createPinia()`                     | 建立 Pinia 實例,之後才能 `app.use(pinia)`                  |
| `pinia.use(userScopedStoresPlugin)` | 讓 store 可用 `userScoped` 選項,登出或登入失效時一併被重置 |

### 應避免的錯誤

- 錯誤1：`userScopedStoresPlugin` 在 `app.use(pinia)` 之後才註冊
  - Pinia 的 plugin 只對「註冊之後才建立」的 store 生效。
- 後果
  - 已建立的 store 不會被重置,登出後下一位使用者可能看到上一位的資料。
- Vue 版做法
  - `pinia.use(...)` 寫在 `app.use(pinia)` 之前。

## 外掛註冊順序

### 設定語法對應效果

| 設定                                       | 效果                                                                |
| ------------------------------------------ | ------------------------------------------------------------------- |
| `app.use(pinia)`                           | 註冊狀態管理,必須早於 router                                        |
| `app.use(i18n)`                            | 註冊多語系(`src/locales/` 的 en、zh-TW)                             |
| `installErrorHandling(app, router)`        | 安裝全域錯誤處理(`plugins/errorHandling.ts`),要在第一次導覽之前     |
| `installAuthExpiredHandler(router, pinia)` | 接上「refresh 失敗(登入失效)」要做的事:重置 store、提示、導到登入頁 |
| `app.use(router)`                          | 註冊路由,同時立刻開始第一次導覽                                     |
| `app.use(vuetify)`                         | 註冊 UI 元件庫                                                      |

### 應避免的錯誤

- 錯誤2：`app.use(router)` 排在 `app.use(pinia)` 之前
  - `app.use(router)` 會立刻開始第一次導覽,路由守衛裡會用到 store。
- 後果
  - 守衛執行時 Pinia 尚未安裝,出現「getActivePinia() was called but there was no active Pinia」。
- Vue 版做法
  - 先 `app.use(pinia)`,最後才 `app.use(router)`。

- 錯誤3：`installErrorHandling`、`installAuthExpiredHandler` 排在 `app.use(router)` 之後
  - 第一次導覽已經開始,錯誤處理與登入失效處理還沒接上。
- 後果
  - 首次導覽中發生的錯誤或 401 沒人處理,使用者看到空白頁或沒有提示。
- Vue 版做法
  - 這兩個都寫在 `app.use(router)` 之前。

## 掛載

### 設定語法對應效果

| 設定                | 效果                                                           |
| ------------------- | -------------------------------------------------------------- |
| `app.mount('#app')` | 把應用程式渲染到 `index.html` 的 `<div id="app">`,放在最後一行 |

### 應避免的錯誤

- 錯誤4：`mount('#app')` 與 `index.html` 的 id 不一致
  - 原 React 版是 `#root`,Vue 版是 `#app`;只改一邊會找不到掛載元素。
- 後果
  - 頁面一片空白,Console 出現 `Failed to mount app: mount target selector "#app" returned null`。
- Vue 版做法
  - `main.ts` 的 `mount('#app')` 與 `index.html` 的 `id="app"` 保持一致。

- 錯誤5：副檔名與 `index.html` 的 script 路徑不一致
  - 原 React 版是 `main.tsx`,Vue 版是 `main.ts`。
- 後果
  - Vite 找不到入口檔,`npm run dev` 與 `npm run build` 失敗。
- Vue 版做法
  - `index.html` 寫 `src="/src/main.ts"`,與實際檔案同名同副檔名。
