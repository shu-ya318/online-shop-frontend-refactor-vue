import { getActivePinia, type Pinia, type PiniaPlugin, type StoreGeneric } from 'pinia'

declare module 'pinia' {
  // 擴充 defineStore 的第三個參數（Pinia 官方的 plugin 寫法），型別參數必須和原本的宣告相同
  export interface DefineStoreOptionsBase<S, Store> {
    /** 登出、換帳號、登入失效時要清空的 store（必須在 setup 裡提供 $reset） */
    userScoped?: boolean
  }
}
/** 每個 pinia 實例各自一份（測試時每個測試建立新的 pinia，不會互相影響） */
const registry = new WeakMap<Pinia, Set<StoreGeneric>>()
const storesOf = (pinia: Pinia): Set<StoreGeneric> => {
  let stores = registry.get(pinia)
  if (!stores) {
    stores = new Set()
    registry.set(pinia, stores)
  }
  return stores
}
/** Pinia plugin：登記帶 userScoped 的 store，供 resetUserScopedStores 統一重設 */
export const userScopedStoresPlugin: PiniaPlugin = ({ pinia, store, options }) => {
  if (!options.userScoped) {
    return
  }
  const stores = storesOf(pinia)
  stores.add(store)
  // store 被 $dispose() 之後就不用再重設
  const originalDispose = store.$dispose
  store.$dispose = () => {
    stores.delete(store)
    originalDispose()
  }
}
/**
 * 重設所有 userScoped 的 store。
 * 注意：Pinia 的 plugin 要在 app.use(pinia) 之後才會生效（測試裡也要先裝到一個 app 上）。
 */
export const resetUserScopedStores = (pinia: Pinia | undefined = getActivePinia()): void => {
  if (!pinia) {
    return
  }
  storesOf(pinia).forEach((store) => store.$reset())
}
