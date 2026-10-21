<script setup lang="ts">
import { useDisplay } from 'vuetify'

import logoUrl from '@/assets/logo_transparent.png'

// 「sm 以上」用 useDisplay() 判斷，不在 CSS 寫死 768px：斷點只維護在 plugins/vuetify.ts 與 styles/settings.scss。
const { smAndUp } = useDisplay()
</script>
<template>
  <div class="auth-layout bg-quaternary pa-sm-8 pa-md-12">
    <div
      class="auth-layout-card bg-quaternary-lighten-1"
      :class="{ 'auth-layout-card-raised': smAndUp }"
    >
      <!-- 左：品牌區。React 版 display: { xs: 'none', sm: 'flex' } -->
      <section
        class="auth-layout-brand d-none d-sm-flex pa-sm-12 pa-md-16"
        aria-label="LookGo 介紹"
      >
        <img :src="logoUrl" alt="LookGo" class="auth-layout__logo" width="240" height="47" />
        <!-- React 版用 Typography h5、caption（會渲染成 <h5>、<span>）；這兩句是介紹文字不是標題，改用 <p> -->
        <p class="auth-layout__tagline text-headline-small">
          一個快速搜尋臺北捷運資訊並規劃旅程的整合平台
        </p>
        <p class="auth-layout__caption text-body-small">
          立即成為會員，蒐藏更多車站、規劃專屬旅程，並加入車站聊天室即時共享資訊!
        </p>
      </section>
      <!-- 右：表單 -->
      <main class="auth-layout__form pa-6 pa-sm-12 pa-md-16">
        <div class="auth-layout__form-inner">
          <RouterView />
        </div>
      </main>
    </div>
  </div>
</template>

<style scoped>
/* 手機：滿版 */
.auth-layout-card {
  display: flex;
  width: 100%;
  min-height: 100vh;
  min-height: 100dvh;
  overflow: hidden;
}

/* sm 以上：卡片 */
.auth-layout-card-raised {
  min-height: 820px;
  border-radius: 24px;
  box-shadow: 0 12px 40px rgb(0 0 0 / 8%);
}

.auth-layout-brand {
  flex: 0 0 45%;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #fff;
  text-align: center;
  background: var(--lookgo-brand-gradient);
}
</style>
