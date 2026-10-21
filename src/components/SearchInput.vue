<script setup lang="ts">
import { mdiMagnify } from '@mdi/js'

withDefaults(
  defineProps<{
    placeholder?: string
    label?: string
    width?: string
  }>(),
  {
    placeholder: '請輸入搜尋',
    label: undefined,
    width: '15.5rem',
  },
)
const keyword = defineModel<string>({ required: true })
</script>

<template>
  <v-text-field
    v-model="keyword"
    :placeholder="placeholder"
    :aria-label="label ?? placeholder"
    :prepend-inner-icon="mdiMagnify"
    :style="{ width }"
    variant="solo-filled"
    flat
    bg-color="input-filled"
    density="compact"
    single-line
    hide-details
    class="search-input"
  />
</template>

<style>
.app-footer-link {
  font-size: 1rem;
  font-weight: 500;
  color: rgb(var(--v-theme-on-surface), var(--v-medium-emphasis-opacity));
  text-decoration: none;
}

.app-footer-link:hover,
.app-footer-link:focus-visible {
  color: rgb(var(--v-theme-primary));
}
</style>
