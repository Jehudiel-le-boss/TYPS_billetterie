<script setup lang="ts">
useGlobalTheme()
useHead({ meta: [{ name: 'description', content: 'TYPS : crée tes billets personnalisés, vends tes entrées et contrôle les accès depuis ton navigateur.' }] })
</script>
<template>
  <NuxtLayout><NuxtPage :transition="{ name: 'page', mode: 'out-in' }" /></NuxtLayout>
  <UiToaster />
</template>
