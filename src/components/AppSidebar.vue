<script setup lang="ts">
import { mdiClose } from '@mdi/js'
import { nextTick, useTemplateRef, watch } from 'vue'

import type { NavItem } from '@/layouts/navItems'

defineProps<{
  items: readonly NavItem[]
}>()
const open = defineModel<boolean>({ required: true })
const closeButton = useTemplateRef<{ $el: HTMLElement }>('closeButton')
// 打開時把焦點移到關閉鈕（之後 Tab 只會在側欄裡移動、Esc 可以關閉）；
// 記住打開前的焦點（漢堡按鈕），關閉後還回去，鍵盤使用者不會被丟回頁面最上方
let returnFocusTo: HTMLElement | null = null
watch(open, async (isOpen) => {
  if (isOpen) {
    returnFocusTo = document.activeElement instanceof HTMLElement ? document.activeElement : null
    await nextTick()
    closeButton.value?.$el.focus()
    return
  }
  const target = returnFocusTo
  returnFocusTo = null
  await nextTick()
  if (target?.isConnected) {
    target.focus()
  }
})
</script>
<template>
  <!-- temporary：蓋在內容上、有半透明背景，點背景關閉。v-navigation-drawer 預設渲染成 <nav> -->
  <v-navigation-drawer
    id="app-sidebar"
    v-model="open"
    temporary
    retain-focus
    aria-label="主選單"
    width="244"
    @keydown.esc="open = false"
  >
    <!-- React 版這一列高 4.375rem（和 Header 一樣高）。Header.tsx:99 把 AppBar 的 z-index 設成 drawer + 1，
         依此推斷這一列（含關閉鈕）會被 Header 蓋住（沒有實際執行 React 版確認）。
         Vuetify 的側欄排在 app bar 下方，不需要預留 Header 的高度，這裡只留一列放關閉鈕 -->
    <div class="app-sidebar__top">
      <v-btn
        ref="closeButton"
        icon
        variant="text"
        color="secondary"
        size="small"
        aria-label="關閉主選單"
        @click="open = false"
      >
        <v-icon :icon="mdiClose" />
      </v-btn>
    </div>
    <v-list nav>
      <v-list-item
        v-for="item in items"
        :key="item.label"
        :to="item.to"
        :prepend-icon="item.icon"
        :title="item.label"
        color="primary"
        class="app-sidebar__item"
        @click="open = false"
      />
    </v-list>
  </v-navigation-drawer>
</template>
