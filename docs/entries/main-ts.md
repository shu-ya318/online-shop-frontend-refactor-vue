# main.ts(src/)

一個區域:應用程式入口。

## 入口職責

### 設定語法對應效果

| 設定                                       | 效果                                        |
| ------------------------------------------ | ------------------------------------------- |
| 只負責建立 app 與掛載                      | 先保持最小可執行,`npm run dev` 能顯示根元件 |
| Pinia、Router、i18n、Keycloak 留到第 11 步 | 避免一開始就把應用程式層混進入口            |
| 副檔名與 index.html 的路徑一致             | Vue 為 `main.ts`,不是原 React 的 `main.tsx` |

### 應避免的錯誤

- 還沒完成結構、測試與 hooks 就先註冊 Pinia、Router、i18n、Keycloak。
- 副檔名與 index.html 的 script 路徑不一致。
