<script setup lang="ts">
defineProps<{ title: string; text?: string }>()
</script>
<template>
  <div class="flex flex-col items-center gap-3 rounded-tk border border-dashed border-line px-6 py-12 text-center">
    <svg width="64" height="64" viewBox="0 0 64 64" fill="none" aria-hidden="true"><rect x="6" y="14" width="52" height="36" rx="8" stroke="rgb(var(--c-a))" stroke-width="2" stroke-dasharray="5 5" /><circle cx="6" cy="32" r="5" fill="rgb(var(--c-bg))" stroke="rgb(var(--c-a))" stroke-width="2" /><circle cx="58" cy="32" r="5" fill="rgb(var(--c-bg))" stroke="rgb(var(--c-a))" stroke-width="2" /><path d="M24 32h16" stroke="rgb(var(--c-b))" stroke-width="2" stroke-linecap="round" /></svg>
    <p class="font-display text-lg font-bold">{{ title }}</p><p v-if="text" class="max-w-sm text-sm text-muted">{{ text }}</p><slot />
  </div>
</template>
