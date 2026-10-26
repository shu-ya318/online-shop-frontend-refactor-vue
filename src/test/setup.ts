// jsdom doesn't implement these, but Vuetify's layout/display composables need them.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver ??= ResizeObserverStub as unknown as typeof ResizeObserver

if (typeof window !== 'undefined' && !window.matchMedia) {
  window.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList
}

if (typeof window !== 'undefined') {
  // Vuetify 的 v-menu／overlay 定位會讀 visualViewport（直接當全域變數用）
  if (!('visualViewport' in globalThis) || !globalThis.visualViewport) {
    const visualViewportStub = {
      get width() {
        return window.innerWidth
      },
      get height() {
        return window.innerHeight
      },
      offsetLeft: 0,
      offsetTop: 0,
      pageLeft: 0,
      pageTop: 0,
      scale: 1,
      addEventListener: () => {},
      removeEventListener: () => {},
    }
    Object.defineProperty(globalThis, 'visualViewport', {
      configurable: true,
      value: visualViewportStub,
    })
  }
  // vue-router 的 scrollBehavior 換頁時會呼叫 scrollTo，jsdom 沒有實作（只會印 Not implemented）
  window.scrollTo = () => {}
}
