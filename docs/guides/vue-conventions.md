# Vue 3.5 專案 Coding Style 規範**

> 待整理： 1.規則內容 2.(可選)理由 3.舉例(正反例均有更好) 4.檢查方式(如：ESLint 強制規範、Code Review Robot 自動審核、例外情形人工判斷)

- 技術前提:

  Vue 3.5、`<script setup lang="ts">`、Composition API、Pinia、Vue Router 4、Vite

- 用途:

  供開發人員查閱，亦作為 code review 的審查依據

## 優先級標籤

> 排列規則時，依照風險等級由高至低為 :red_circle:→ :yellow_circle: → :green_circle: → :warning:

| 標籤                 | 意義                            | 對應                                    |
| -------------------- | ------------------------------- | --------------------------------------- |
| :red_circle: 必須    | 違反會造成 bug 或嚴重不一致     | Priority A Rules：Essential             |
| :yellow_circle: 應該 | 確保可讀性與一致性              | Priority B Rules： Strongly Recommended |
| :green_circle: 建議  | 確保風格統一                    | Priority C Rules：Recommended           |
| :warning: 謹慎       | 針對例外情境,建議人工判斷後決定 | Priority D Rules：Use with Caution      |

## 分類總覽

| 篇     | \#  | 類別                 |
| ------ | --- | -------------------- |
| 呈現層 | 1   | 命名規範             |
|        | 2   | SFC 規範             |
|        | 3   | 模板語法規範         |
|        | 4   | 樣式規範             |
| 邏輯層 | 5   | Composition API 規範 |
|        | 6   | 元件間的資料傳遞     |
|        | 7   | Composable 規範      |
| 資料層 | 8   | TypeScript           |
|        | 9   | API 請求層           |
|        | 10  | 狀態管理(Pinia)      |
| 結構層 | 11  | 路由(Vue Router)     |

# 第一篇:呈現層

## 1. 命名規範

### 1-1 元件與檔案命名

- :red_circle: [出處：Priority A Rules：Essential] 元件名稱必須為多個單字(根元件 `App` 除外),避免與 HTML 元素衝突。
- :yellow_circle: [出處：Priority B Rules： Strongly Recommended] 檔名統一 PascalCase(`UserCard.vue`),全專案不混用。
- :yellow_circle: [出處：Priority B Rules： Strongly Recommended] 模板中的元件使用 PascalCase(`<UserCard />`),與原生元素和 Web Component 區隔。
- :yellow_circle: [出處：Priority B Rules： Strongly Recommended] 緊密耦合的子元件以父元件名為前綴:`TodoList` → `TodoListItem` → `TodoListItemButton`。
- :yellow_circle: [出處：Priority B Rules： Strongly Recommended] 基礎元件(展示型、無狀態)統一前綴,如 `BaseButton`、`BaseTable`。
- :yellow_circle: [出處：Priority B Rules： Strongly Recommended] 單例元件(整個應用僅一個實例)以 `The` 為前綴,如 `TheHeader`、`TheSidebar`。
- :yellow_circle: [出處：Priority B Rules： Strongly Recommended] 名稱中通用詞在前、修飾詞在後:`SearchButtonClear`,不寫 `ClearSearchButton`。
- :yellow_circle: [出處：Priority B Rules： Strongly Recommended] 使用完整單字,不用少見縮寫(`StudentDashboardSettings`,不寫 `SdSettings`)。

### 1-2 識別字命名

- :yellow_circle: [出處：Vue 官方文件] Composable 檔名與函式名皆以 `use` 開頭(`useAuth`)。
- :yellow_circle: [出處：Pinia 官方] Store 以 `use***Store` 命名(`useUserStore`)。
- :yellow_circle: [出處：Priority B Rules： Strongly Recommended] Prop 宣告使用 camelCase;模板中 kebab-case 或 camelCase 擇一,全專案一致。
- :yellow_circle: [出處：前端社群，待討論] 事件名稱語意化,以動詞或過去式表達(`submit`、`update:modelValue`、`item-selected`)。

## 2. SFC 規範

- :yellow_circle: [出處：前端社群，待討論] 單一 SFC 過長(如：超過 300 行)時,拆出子元件或 Composable。
- :yellow_circle: [出處：Vue 官方文件] 統一使用 `<script setup lang="ts">`,不用 Options API 與 `defineComponent`(除非有特殊需求)。
- :yellow_circle: [出處：Priority B Rules： Strongly Recommended] 一個元件一個檔案,避免用多個 `app.component()` 集中定義。
- :green_circle: [出處：Priority C Rules：Recommended] `<script setup>` 內部順序:
  1.  `import`
  2.  `defineOptions`
  3.  `defineProps` / `defineEmits` / `defineModel` / `defineSlots`
  4.  Composable 與 Store 呼叫
  5.  `ref` / `reactive`
  6.  `computed`
  7.  `watch` / `watchEffect`
  8.  函式(事件處理、方法)
  9.  生命週期鉤子
  10. `defineExpose`
- :green_circle: [出處：Priority C Rules：Recommended] 區塊順序由前至後依序為 `<script setup>` → `<template>` → `<style>`。
- :green_circle: [出處：Priority C Rules：Recommended] 多行宣告之間(如：多個 `computed`)以空行分隔。

## 3. 模板語法規範

- :red_circle: [出處：Priority A Rules：Essential] `v-for` 必須搭配 `:key`,且使用唯一識別值(`:key="todo.id"`),不用 index(除非是靜態列表)。
- :red_circle: [出處：Priority A Rules：Essential] 禁止 `v-if` 與 `v-for` 用在同一元素:篩選改用 `computed`,或用 `<template v-for>` 搭配內層 `v-if`;整份隱藏時將 `v-if` 移到外部容器。
- :yellow_circle: [出處：Priority B Rules： Strongly Recommended] 模板只放簡單表達式,複雜邏輯抽成 `computed` 或函式。
- :yellow_circle: [出處：Priority B Rules： Strongly Recommended] 多屬性元素每行一個屬性。
- :yellow_circle: [出處：Priority B Rules： Strongly Recommended] 無內容元件在 SFC 內使用自閉合(`<MyComponent />`);in-DOM 模板不可自閉合。
- :yellow_circle: [出處：Priority B Rules： Strongly Recommended] 全部使用指令縮寫(`:`、`@`、`#`),不混用指令縮寫與完整語法。
- :yellow_circle: [出處：Priority B Rules： Strongly Recommended] 非空的屬性值一律加引號。
- :green_circle: [出處：前端社群，待討論] 避免在模板中建立新物件或匿名函式作為 props。
- :green_circle: [出處：Priority C Rules：Recommended] 屬性順序:`is` → `v-for` → `v-if/v-else-if/v-else/v-show` → `v-once` → `id` → `ref/key` → `v-model` → 其他屬性 → 事件(`@`)→ `v-html/v-text`。

## 4. 樣式規範

- :red_circle: [出處：Priority A Rules：Essential] 非頂層元件的樣式必須範疇化(如：`<style scoped>`、CSS Modules 或 BEM 命名,全專案擇一)。
- :red_circle: [出處：Priority A Rules：Essential] 禁止未範疇化的通用類別名稱(如：全域 `.btn-close`)。
- :yellow_circle: [出處：Priority A Rules：Essential] 元件庫優先使用類別命名策略，而非 `scoped`。
- :green_circle: [出處：前端社群，待討論] 樣式命名規則統一規範,不混用。
- :green_circle: [出處：Vue 官方文件] 深層覆寫使用 `:deep()`,並限縮在單一類別之下;動態值使用 CSS `v-bind()`。
- :green_circle: [出處：Priority A Rules：Essential] 頂層 `App` 與 layout 元件可使用全域樣式。
- :warning: [出處：Priority D Rules：Use with Caution] `scoped` 內優先使用類別選擇器,避免元素選擇器。

# 第二篇:邏輯層

## 5. Composition API 規範

- 範圍:元件內與 Composable 內「使用」API 的規則

### 5-1 響應式

- :red_circle: [出處：Vue 官方文件] 禁止直接解構 `reactive` 物件(因會失去響應性),須用 `toRefs` / `toRef`。
- :yellow_circle: [出處：Vue 官方文件] `computed` 必須為純函式。
- :yellow_circle: [出處：Vue 官方文件] 預設使用 `ref`;`reactive` 僅用於固定結構的物件。
- :yellow_circle: [出處：Priority B Rules： Strongly Recommended] 複雜的 `computed` 須拆成多個簡單的 `computed`(如 `basePrice`、`discount`、`finalPrice`)。
- :yellow_circle: [出處：Vue 官方文件] 對外暴露狀態時,只暴露 `readonly()` 版本。
- :green_circle: [出處：前端社群，待討論] 大型不可變資料使用 `shallowRef`。

### 5-2 生命週期

- :red_circle: [出處：Vue 官方文件] 生命週期鉤子須在 `setup` 同步階段註冊(不可在 `await` 之後、回呼內註冊)。
- :red_circle: [出處：前端社群，待討論] 副作用(如：事件監聽、計時器、訂閱等),必須在 `onUnmounted` 或 `onScopeDispose` 清理。
- :yellow_circle: [出處：Vue 官方文件] 僅限瀏覽器執行的初始化(如：操作 DOM、初始化第三方套件)放在 `onMounted`。
- :yellow_circle: [出處：前端社群，待討論] 不在 `onUpdated` 內修改響應式狀態(因避免無限更新)。

### 5-3 偵聽器

- :red_circle: [出處：Vue 官方文件] `watchEffect` 內 `await` 之後存取的響應式資料不會被追蹤,須在 `await` 之前讀取。
- :yellow_circle: [出處：Vue 官方文件] `watch` 僅用於副作用(呼叫 API、同步外部狀態),不用來同步衍生資料(改用 `computed`)。
- :yellow_circle: [出處：Vue 官方文件] 非同步請求須處理取消或競態,使用 `onWatcherCleanup`(3.5+)或 `AbortController`。
- :yellow_circle: [出處：Vue 官方文件] 需要「新舊值」或「Lazy 執行」用 `watch`;需要自動追蹤依賴並立即執行用 `watchEffect`。
- :warning: [出處：前端社群，待討論] `deep: true` 慎用(大型物件效能差),優先監聽具體屬性。

### 5-4 Vue 3.5 新 API

- :green_circle: [出處：Vue 官方文件] Template ref 使用 `useTemplateRef()`,取代與變數同名綁定。
- :green_circle: [出處：Vue 官方文件] Props 解構(Reactive Props Destructure)可用,且可搭配預設值。
- :green_circle: [出處：Vue 官方文件] 表單與無障礙所需的唯一 ID 使用 `useId()`(因考量 SSR 安全)。

## 6. 元件間的資料傳遞

### 6-1 Props 與 Emits

- :red_circle: [出處：Priority D Rules：Use with Caution] 禁止子元件直接修改 prop(含 prop 物件的屬性,如： `props.todo.text = ...`、`v-model="todo.text"`)。
- :red_circle: [出處：Priority A Rules：Essential] Props 必須定義型別,使用 `defineProps<Props>()`;不使用陣列寫法(除非是原型階段)。
- :red_circle: [出處：Priority D Rules：Use with Caution] 單向資料流:props 向下、events 向上。
- :yellow_circle: [出處：Vue 官方文件] Emits 必須宣告型別:`defineEmits<{ (e: 'change', value: string): void }>()`。
- :yellow_circle: [出處：Vue 官方文件] 雙向綁定一律使用 `defineModel()`。
- :yellow_circle: [出處：前端社群，待討論] 元件介面保持精簡,Props 過多(如：超過 7 個)時評估拆分或改用 Slot。
- :green_circle: [出處：Vue 官方文件] 需要對外暴露實例方法時,使用 `defineExpose` 並限縮範圍。

### 6-2 Slot 與跨層溝通

- :yellow_circle: [出處：Vue 官方文件] `provide` 端對外提供 `readonly` 狀態,修改狀態的方法由提供端定義。
- :green_circle: [出處：Vue 官方文件] Slot 有明確命名,需要傳值時使用 `defineSlots` 宣告型別。
- :warning: [出處：Vue 官方文件] 跨層傳遞使用 `provide/inject`,且必須搭配 `InjectionKey<T>`;`inject` 須設預設值或檢查 `undefined`。
- :warning: [出處：Priority D Rules：Use with Caution] 禁止使用 `$parent`、`$children` 等隱式父子溝通;高度耦合的特例須在 Review 說明。

## 7. Composable 規範

- 範圍:把邏輯「封裝成可重用函式」
- :red_circle: [出處：前端社群，待討論] 副作用的清理責任在 Composable 內部(`onScopeDispose`),不可交由呼叫端處理。
- :yellow_circle: [出處：前端社群，待討論] 放在 `composables/`(或 feature 內的 `composables/`)。
- :yellow_circle: [出處：前端社群，待討論] 單一職責:一個 Composable 只處理一件事;過大時拆分。
- :yellow_circle: [出處：Vue 官方文件] 輸出明確:回傳具名物件(非陣列,除非是 2 個以內的 tuple 且語意明確),並明確標註型別。
- :yellow_circle: [出處：Vue 官方文件] 輸入彈性:參數使用 `MaybeRefOrGetter<T>`,內部以 `toValue()` 取值。
- :yellow_circle: [出處：前端社群] 不在 Composable 內直接操作 DOM(需要時透過傳入的 ref)或寫死路由跳轉。
- :yellow_circle: [出處：Vue 官方文件] 不在 Composable 內存取其他元件的內部狀態;跨元件共用狀態使用 Pinia。
- :green_circle: [出處：前端社群，待討論] 判斷何時抽成 Composable:邏輯含響應式狀態且被 2 處以上重用,或單一元件邏輯已難以閱讀。純計算函式放 `utils/`。

# 第三篇:資料層

## 8. TypeScript

- 範圍:通用型別規則;使用情境的型別規則見各類別
- :red_circle: [出處：TypeScript／typescript-eslint] 禁止濫用 `any`,不確定的型別使用 `unknown` 並縮小範圍。
- :red_circle: [出處：前端社群，待討論] 開啟 `strict` 模式。
- :yellow_circle: [出處：TypeScript／typescript-eslint] 原則上禁止以 `as` 強制轉型繞過型別檢查(例外情形則依個案情境審核)。
- :yellow_circle: [出處：前端社群，待討論] 共用型別放 `types/`(或 feature 內的 `types/`),僅單一元件使用的型別就近宣告。
- :yellow_circle: [出處：TypeScript／typescript-eslint] 物件結構優先使用 `interface`,聯集、交集、工具型別使用 `type`。
- :green_circle: [出處：前端社群，待討論] 元件實例型別使用 `InstanceType<typeof Comp>`;泛型命名具語意(`TItem`,不只用 `T`)。

### 各類別中的型別規則(索引)

| 類別               | 型別規則                                                                               |
| ------------------ | -------------------------------------------------------------------------------------- |
| 5 Composition API  | `ref<T>()`、`useTemplateRef` 型別                                                      |
| 6 元件間的資料傳遞 | `defineProps<Props>()`、`defineEmits` 型別、`defineSlots`、`InjectionKey<T>`、泛型元件 |
| 7 Composable       | 參數與回傳型別明確、`MaybeRefOrGetter<T>`                                              |
| 9 API 請求層       | Request / Response 型別、DTO 與 Model 轉換                                             |
| 10 Pinia           | State 型別、Getter 回傳型別                                                            |
| 11 路由            | `meta` 型別擴充、路由參數型別                                                          |

## 9. API 請求層

- :red_circle: [出處：前端社群，待討論] API 呼叫集中在 `api/` 或 `services/`,元件與 Store 均不直接呼叫 axios / fetch。
- :yellow_circle: [出處：前端社群，待討論] 集中處理 interceptor、token 附加、錯誤轉換與逾時設定。
- :yellow_circle: [出處：前端社群，待討論] 錯誤處理統一:API 層拋出具型別的錯誤,由呼叫端或全域處理器決定呈現方式。
- :yellow_circle: [出處：前端社群，待討論] Request 與 Response 皆定義型別。
- :yellow_circle: [出處：前端社群，待討論] 請求須可取消(`AbortSignal`),避免競態與元件卸載後更新狀態。

## 10. 狀態管理(Pinia)

- :red_circle: [出處：Pinia 官方] 解構 Store 的 state / getters 必須使用 `storeToRefs`;actions 可直接解構。
- :yellow_circle: [出處：前端社群，待討論] 元件局部狀態不放入 Store,僅放跨元件、跨頁面共用的狀態。
- :yellow_circle: [出處：前端社群，待討論] State 對外以 `readonly` 或 getter 暴露,修改只透過 actions。
- :yellow_circle: [出處：Pinia 官方] 依功能領域拆分 Store,避免單一巨型 Store。
- :yellow_circle: [出處：前端社群，待討論] 使用 Setup Store 寫法(`defineStore('id', () => { ... })`)。
- :yellow_circle: [出處：前端社群，待討論] State、getters、actions 皆明確標註型別。
- :yellow_circle: [出處：前端社群，待討論] Store 之間的依賴單向,避免循環引用。
- :green_circle: [出處：前端社群，待討論] 需持久化的狀態使用 Pinia 外掛統一處理,不在各 Store 自行寫 `localStorage`。

# 第四篇:結構層

## 11. 路由(Vue Router)

- :yellow_circle: [出處：Vue Router 官方] 路由元件使用 lazy loading:`component: () => import('...')`。
- :yellow_circle: [出處：Vue Router 官方] 使用具名路由(`name`)導航,避免寫死路徑字串。
- :yellow_circle: [出處：Vue Router 官方] 權限控制集中於 navigation guard,不分散在各頁面。
- :yellow_circle: [出處：前端社群，待討論] 頁面元件放 `views/` 或 `pages/`,可重用元件放 `components/`。
- :yellow_circle: [出處：前端社群，待討論] 路由設定集中管理,依功能模組拆分路由檔。
- :green_circle: [出處：前端社群，待討論] 路由參數在頁面內做型別縮窄與驗證。
- :green_circle: [出處：Vue Router 官方] 路由 `meta` 做型別擴充(`RouteMeta`)。

# 附錄:非 Vue Style Guide 的出處連結

## A. Vue 官方文件

- Composables:https://vuejs.org/guide/reusability/composables
- SFC `<script setup>`(含 `defineExpose`):https://vuejs.org/api/sfc-script-setup.html
- SFC CSS Features(`:deep()`、`v-bind()`):https://vuejs.org/api/sfc-css-features
- Reactivity Fundamentals(reactive 的限制):https://vuejs.org/guide/essentials/reactivity-fundamentals.html#limitations-of-reactive
- Computed Properties:https://vuejs.org/guide/essentials/computed
- Provide / Inject:https://vuejs.org/guide/components/provide-inject
- Lifecycle Hooks:https://vuejs.org/guide/essentials/lifecycle
- Lifecycle API:https://vuejs.org/api/composition-api-lifecycle
- SSR:https://vuejs.org/guide/scaling-up/ssr
- Watchers:https://vuejs.org/guide/essentials/watchers
- Reactivity API: Core(`onWatcherCleanup`):https://vuejs.org/api/reactivity-core
- Announcing Vue 3.5:https://blog.vuejs.org/posts/vue-3-5
- TypeScript with Composition API:https://vuejs.org/guide/typescript/composition-api
- Component v-model(`defineModel`):https://vuejs.org/guide/components/v-model
- State Management:https://vuejs.org/guide/scaling-up/state-management
- Performance(Props Stability):https://vuejs.org/guide/best-practices/performance

## B. Pinia 官方

- Core Concepts:https://pinia.vuejs.org/core-concepts/
- Core Concepts(中文):https://pinia.vuejs.org/zh/core-concepts

## C. Vue Router 官方

- Lazy Loading Routes:https://router.vuejs.org/guide/advanced/lazy-loading
- Named Routes:https://router.vuejs.org/guide/essentials/named-routes
- Navigation Guards:https://router.vuejs.org/guide/advanced/navigation-guards
- Route Meta Fields:https://router.vuejs.org/guide/advanced/meta
- RouteMeta API:https://router.vuejs.org/api/interfaces/RouteMeta.html

## D. TypeScript／typescript-eslint

- no-explicit-any:https://typescript-eslint.io/rules/no-explicit-any
- consistent-type-assertions:https://typescript-eslint.io/rules/consistent-type-assertions
- TypeScript Handbook(type 與 interface 的差異):https://www.typescriptlang.org/docs/handbook/2/everyday-types.html#differences-between-type-aliases-and-interfaces
