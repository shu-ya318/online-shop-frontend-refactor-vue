# 狀態管理

## Pinia

### 核心特質

- **Setup Store 組合式架構**：採用 Vue 3 Composition API 語法 (`ref`, `computed`, `function`)，實現邏輯高度獨立性與擴充性。
- **自動細粒度響應訂閱**：依靠 Vue 響應式系統自動追蹤 Template 實際讀取的屬性並精準訂閱，無須手動撰寫 Selector。
- **安全解構與單向數據流**：解構 State/Getter 時透過 `storeToRefs()` 維持響應性；狀態變更統一由 Action 負責，禁止元件隨意修改。
- **模組獨立與集中重置**：各 Store 職責單一具備完整 TypeScript 型別，並可透過 Pinia Plugin（如 `userScoped`）達跨 Store 一鍵重置機制。

### 和 zustand 重要差異

| 比較維度         | Pinia (Vue 3)                                                                    | Zustand (React)                                                           |
| :--------------- | :------------------------------------------------------------------------------- | :------------------------------------------------------------------------ |
| **訂閱機制**     | **自動追蹤**：Template 讀取的屬性自動精準訂閱，無多餘開銷                        | **手動指定**：須顯式撰寫 Selector，否則預設訂閱全 Store 易引發無效重繪    |
| **定義範式**     | **Setup Store**：語法與 Composition API 完全一致 (`ref`, `computed`, `function`) | **Hook 工廠**：經由 `create()` 定義狀態與變更方法                         |
| **解構寫法**     | **語法安全**：State/Getter 須經 `storeToRefs()` 保留響應性                       | **直接解構**：可直接解構，但漏寫 Selector 會引發全量刷新                  |
| **狀態真相來源** | **單一來源**：結合 `tokenManager` / `customRef` 等管理，防止資料副本不同步       | **多重副本**：常搭配 `persist` 中間件存於 LocalStorage，易致狀態同步失效  |
| **UI 解耦原則**  | **邏輯純粹**：Store 僅維護狀態與暴露 Error State，彈窗與通知由 UI 層自主控制     | **強行耦合**：易於 Store 內部直接呼叫 UI 通知 (如 Snackbar)，破壞分層架構 |

## 1. authStore (Token 與驗證狀態)

### 流程

```text
[ 正確流程 ]
Token 集中寫入 tokenManager (作為單一真相來源)
   │
   ▼
authStore 透過 customRef / Getter 提供唯讀驗證狀態
   │
   ▼
登出時呼叫 endSession() 觸發登出 API
   │
   ▼
經由 Pinia Plugin (userScoped) 一鍵重置所有使用者關聯 Store ($reset)

[ 錯誤流程 ]
使用 persist 中間件將 Token 存於 Store 與 LocalStorage (產生雙重副本)
   │
   ▼
分散在各元件與 API Response 中手動寫入/修改 Token
   │
   ▼
登出時僅執行 clearAuth() 清除 Token
   │
   ▼
❌【問題】雙重副本同步失效，且 userStore 等敏感資料殘留未清空
```

## 2. userStore (使用者資料與併發快取)

### 流程

```text
[ 正確流程 ]
多個元件併發呼叫 ensureUser() (如 Layout / Header / Guard)
   │
   ▼
Store 檢查已有資料或進行中的 Promise (ensureUserPromise)
   │
   ├─► 已有資料/請求中：直接回傳既有 Promise (共用請求，僅發 API 一次)
   │
   └─► 無資料：發送 API 請求 ──► 成功後更新 Store 狀態

[ 錯誤流程 ]
多個元件在 mount 時各自呼叫 getCurrentUser()
   │
   ▼
未經併發鎖定，重複發送 3 次相同的 API 請求
   │
   ▼
各自 Response 回傳後直接 setState 寫入 Store
   │
   ▼
❌【問題】觸發競態衝突 (後回應覆蓋最新資料) 且造成無效網路開銷
```

## 3. metroMapStore (地圖資料與 Promise 共用)

### 流程

```text
[ 正確流程 ]
多個卡片元件同時呼叫 fetchMetroMap()
   │
   ▼
Store 保存進行中的 Promise (metroMapRequest) 共用請求
   │
   ├─► 請求成功：寫入地圖路線與車站資料 (lines / stations)
   │
   └─► 請求失敗：將錯誤寫入 metroMapError (不直接彈窗，交由 UI 控制)

[ 錯誤流程 ]
各卡片元件 mount 時個別觸發 API 請求
   │
   ▼
缺乏 Promise 快取，導致瞬間重複發送 8 次 get-metro-map 請求
   │
   ▼
API 失敗時直接在 Store 內部呼叫 enqueueSnackbar()
   │
   ▼
❌【問題】無效重複請求、多卡片同時失敗引發 UI 彈窗洗版破壞解耦
```

## 4. stationStore (車站詳情與最新回應防競態)

### 流程

```text
[ 正確流程 ]
使用者快速切換車站 (A站 ──► B站)
   │
   ▼
Store 遞增請求編號 (latestRequestId + 1)，並將設施篩選收攏於 Store
   │
   ▼
API 非同步回傳時，驗證回應編號是否為最新 (isLatest)
   │
   ├─► 是最新請求 (B站)：寫入 stationDetail 狀態
   │
   └─► 屬舊請求 (A站)：直接丟棄，防止舊資料覆蓋

[ 錯誤流程 ]
使用者快速切換車站 (A站 ──► B站)
   │
   ▼
未記錄請求編號，且將設施篩選分散於元件本地 state
   │
   ▼
A站請求因網路延遲較晚回傳，B站請求較早回傳
   │
   ▼
❌【問題】A站舊資料覆蓋 B站新資料 (競態衝突)，且篩選狀態與 Store 不同步
```

## 5. stationBookmarkStore (書籤狀態與集中維護)

### 流程

```text
[ 正確流程 ]
使用者點擊書籤按鈕 (toggleBookmark)
   │
   ▼
先執行 await ensureLoaded() 確保書籤清單已完整載入
   │
   ▼
檢查防重鎖定狀態 (isPending)
   │
   ├─► 進行中：鎖定按鈕 / 回傳既有 Promise，阻擋重複點擊
   │
   └─► 空閒中：發送新增/刪除 API ──► 成功後同步更新 Store 清單

[ 錯誤流程 ]
使用者點擊書籤按鈕
   │
   ▼
元件未確認資料是否載入，直接在本地用 bookmarks.find() 判斷
   │
   ▼
缺乏防重連點 (isPending) 控管
   │
   ▼
快速連點兩下，觸發兩次相同的「新增」或「刪除」API 請求
   │
   ▼
❌【問題】資料未載入導致狀態判斷錯誤，且觸發重複 API 請求產生 Bug
```
