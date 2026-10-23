<script lang="ts"></script>

<template>
  <main class="error-page">
    <!-- React 版用 Typography h4（渲染成 <h4>），整頁沒有 <h1>；這裡是頁面主標題，用 <h1> -->
    <h1 class="text-headline-large">查無頁面</h1>
    <p class="text-body-large">您要找的頁面不存在</p>
    <v-btn :to="{ name: 'home' }" color="primary" variant="flat">返回首頁</v-btn>
  </main>
</template>

<style scoped></style>
