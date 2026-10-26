import { computed, inject, provide, reactive, ref, toRaw, watch, type InjectionKey } from 'vue'

/** 驗證結果：null 代表通過，字串是要顯示的錯誤訊息 */
export type ErrorMessage = string | null
/** 同步規則：拿到這個欄位的值與整份表單的值（跨欄位比對用） */
export type Rule<T, K extends keyof T = keyof T> = (value: T[K], values: T) => ErrorMessage
/** 非同步規則（例如打 API 檢查 email 是否已註冊）：signal 會在新的一輪開始時被 abort */
export type AsyncRule<T, K extends keyof T = keyof T> = (
  value: T[K],
  values: T,
  signal: AbortSignal,
) => Promise<ErrorMessage>
export type RuleMap<T> = { [K in keyof T]?: Rule<T, K>[] }
export type AsyncRuleMap<T> = { [K in keyof T]?: AsyncRule<T, K>[] }
export type DepMap<T> = { [K in keyof T]?: (keyof T)[] }
type Flags<T> = Partial<Record<keyof T, boolean>>

export interface UseFormOptions<T extends object> {
  initialValues: T
  rules?: RuleMap<T>
  asyncRules?: AsyncRuleMap<T>
  /** 跨欄位依賴：{ confirmPassword: ['newPassword'] } 代表 newPassword 改了要重驗 confirmPassword */
  deps?: DepMap<T>
  /** 已 touched 的欄位在輸入時，要停手多久才打非同步驗證（毫秒） */
  asyncDebounceMs?: number
  /** 驗證全部通過才會被呼叫，收到的是值的快照。API 錯誤請在這裡自己 try/catch */
  onSubmit: (values: T) => void | Promise<void>
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

/** 一般物件（{} 或 Object.create(null)）；Date、File、class 實例都不算 */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null) return false
  const proto: unknown = Object.getPrototypeOf(value)
  return proto === Object.prototype || proto === null
}

/**
 * 深拷貝「表單資料」：陣列與一般物件逐層複製；字串、數字、Date、File 等原樣保留。
 * 逐層複製後 TS 只知道是 unknown[] / Record<string, unknown>，結構和輸入相同，所以轉回 V
 */
function deepClone<V>(value: V): V {
  const raw = toRaw(value) // 傳進來的可能是 reactive 物件，先拿原始物件
  if (Array.isArray(raw)) return raw.map((item) => deepClone(item)) as V
  if (isPlainObject(raw)) {
    return Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, deepClone(v)])) as V
  }
  return raw
}
/** 比內容，不比「是不是同一個物件」。a 可以是 reactive 代理：透過它讀取，computed 才追蹤得到 */
function deepEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((item, i) => deepEqual(item, b[i]))
  }
  if (isPlainObject(a) && isPlainObject(b)) {
    const keys = Object.keys(a)
    return keys.length === Object.keys(b).length && keys.every((k) => deepEqual(a[k], b[k]))
  }
  return false
}

export function useForm<T extends object>(options: UseFormOptions<T>) {
  const { asyncDebounceMs = 400, onSubmit } = options
  const initialValues = deepClone(options.initialValues) // 基準線快照：之後怎麼改 values 都不會動到它
  const rules: RuleMap<T> = options.rules ?? {}
  const asyncRules: AsyncRuleMap<T> = options.asyncRules ?? {}
  const deps: DepMap<T> = options.deps ?? {}
  // Object.keys 的型別固定是 string[]（TS 不保證物件沒有多餘的 key），這裡的 key 都來自 initialValues，轉型安全
  const keys = Object.keys(initialValues) as (keyof T)[]
  // ---- 狀態：值、錯誤、摸過沒、驗證中 ----
  // 工作副本：陣列、物件欄位也各自一份。
  // reactive() 回傳 Reactive<T>（型別上會解開 ref），泛型 T 時 TS 算不出它等於 T；
  // 表單值是純資料、不會放 ref，兩者實際相同，所以這裡是唯一需要轉型的狀態
  const values = reactive(deepClone(initialValues)) as T
  // 下面三個一開始都是空物件，{} 本來就符合「全部可選」的型別，用型別標註即可，不需要轉型
  const errors: Partial<Record<keyof T, string>> = reactive({})
  const touched: Flags<T> = reactive({})
  const validating: Flags<T> = reactive({})
  const isSubmitting = ref(false)
  const submitCount = ref(0)
  // ---- 衍生狀態：全部用 computed 算，不另外存 ----
  const dirty = computed(() => {
    const result: Flags<T> = {}
    // 比內容：陣列 push 再刪回來就不算改過
    for (const k of keys) result[k] = !deepEqual(values[k], initialValues[k])
    return result
  })
  const isDirty = computed(() => keys.some((k) => dirty.value[k]))
  /** 目前畫面上沒有任何錯誤（還沒驗證過的欄位不算錯） */
  const isValid = computed(() => keys.every((k) => !errors[k]))

  // ---- 驗證 ----
  function setError(k: keyof T, message: ErrorMessage) {
    if (message) errors[k] = message
    else delete errors[k] // 刪掉 key，errors 才會是 {}，而不是 { email: undefined }
  }
  /** 依序跑同步規則，回傳第一個錯誤 */
  function runSyncRules(k: keyof T): ErrorMessage {
    for (const rule of rules[k] ?? []) {
      const message = rule(values[k], values)
      if (message) return message
    }
    return null
  }

  const runIds: Partial<Record<keyof T, number>> = {}
  const controllers: Partial<Record<keyof T, AbortController>> = {}
  const latestRuns = new Map<keyof T, Promise<boolean>>() // 每個欄位「最新一輪」的結果
  function validateField(k: keyof T, opts: { debounce?: boolean } = {}): Promise<boolean> {
    const run = runValidation(k, opts)
    latestRuns.set(k, run)
    return run
  }
  // 過期的一輪不寫入任何狀態，改成回傳最新一輪的結果：送出時等的就一定是最新的答案
  const latestResult = (k: keyof T) => latestRuns.get(k) ?? Promise.resolve(false)
  async function runValidation(k: keyof T, opts: { debounce?: boolean }): Promise<boolean> {
    const id = (runIds[k] = (runIds[k] ?? 0) + 1) // 領一張新號碼牌，舊的全部作廢
    controllers[k]?.abort() // 上一輪如果還在打 API，直接取消
    const value = values[k]
    const syncMessage = runSyncRules(k)
    const asyncList = asyncRules[k] ?? []
    if (syncMessage || asyncList.length === 0) {
      setError(k, syncMessage) // 同步規則沒過，就不用浪費一次 API
      validating[k] = false
      return !syncMessage
    }
    setError(k, null)
    validating[k] = true
    if (opts.debounce) await sleep(asyncDebounceMs)
    if (id !== runIds[k]) return latestResult(k) // 等待期間又有新的一輪：這一輪作廢，改等最新一輪
    const controller = (controllers[k] = new AbortController())
    try {
      for (const rule of asyncList) {
        const message = await rule(value, values, controller.signal)
        if (id !== runIds[k]) return latestResult(k) // 結果回來時已經不是最新：丟掉，改等最新一輪
        if (message) {
          setError(k, message)
          return false
        }
      }
      return true
    } catch {
      if (id !== runIds[k]) return latestResult(k) // 被 abort 的請求也會走到這裡
      setError(k, '暫時無法驗證，請稍後再試')
      return false
    } finally {
      if (id === runIds[k]) validating[k] = false // 只有最新一輪有資格結束 validating
    }
  }
  /** 驗證全部欄位（不會改 touched），全部通過回傳 true */
  async function validate(): Promise<boolean> {
    const results = await Promise.all(keys.map((k) => validateField(k)))
    return results.every(Boolean)
  }

  function handleBlur(k: keyof T) {
    touched[k] = true // 離開過欄位才開始顯示錯誤
    void validateField(k)
  }

  for (const k of keys) {
    watch(
      () => values[k],
      () => {
        if (touched[k]) void validateField(k, { debounce: true }) // 摸過的欄位：邊打邊驗
        for (const other of keys) {
          if (other !== k && touched[other] && deps[other]?.includes(k)) void validateField(other)
        }
      },
      { deep: true }, // 陣列、物件欄位在原地修改（push）也要觸發
    )
  }

  async function handleSubmit() {
    if (isSubmitting.value) return // 防連點：送出中再按一次（或再按 Enter）直接忽略
    isSubmitting.value = true
    submitCount.value++
    try {
      for (const k of keys) touched[k] = true // 送出時全部視為摸過
      if (!(await validate())) return
      await onSubmit(deepClone(values)) // 交出深拷貝的快照，外面改不到表單內部
    } finally {
      isSubmitting.value = false
    }
  }

  /** 放入後端回傳的欄位錯誤；之後改值時會被前端驗證的結果蓋掉 */
  function setErrors(next: Partial<Record<keyof T, string>>) {
    for (const k of keys) {
      const message = next[k]
      if (message) setError(k, message)
    }
  }

  /** 回到初始狀態：值、錯誤、touched 全部清掉，進行中的驗證作廢 */
  function reset() {
    for (const k of keys) {
      runIds[k] = (runIds[k] ?? 0) + 1
      controllers[k]?.abort()
      values[k] = deepClone(initialValues[k])
      setError(k, null)
      delete touched[k]
      delete validating[k]
    }
    submitCount.value = 0
  }

  return {
    values,
    errors,
    touched,
    validating,
    dirty,
    isDirty,
    isValid,
    isSubmitting,
    submitCount,
    validateField,
    validate,
    handleBlur,
    handleSubmit,
    setErrors,
    reset,
  }
}

// ---- provide／inject：讓 <FormField name="email"> 自己找到自己的錯誤 ----
/**
 * FormField 只需要「讀錯誤、讀驗證中、通知 blur」三件事，所以 context 只有這三樣。
 * handleBlur 用「方法寫法」宣告，useForm<LoginValues> 的回傳值才能直接傳給 provideForm，不用轉型。
 */
export interface FormContext {
  errors: Partial<Record<string, string>>
  validating: Partial<Record<string, boolean>>
  handleBlur(name: string): void
}
export const FormContextKey: InjectionKey<FormContext> = Symbol('FormContext')
export function provideForm(form: FormContext) {
  provide(FormContextKey, form)
}
/** FormField 內部使用。找不到表單時直接丟錯，比默默不顯示錯誤好除錯 */
export function injectForm(): FormContext {
  const form = inject(FormContextKey, null)
  if (!form) throw new Error('FormField 必須放在呼叫過 provideForm() 的元件裡面')
  return form
}
