<script setup lang="ts">
useGlobalTheme()
const config = useRuntimeConfig()
const requestUrl = useRequestURL()
const canonicalUrl = computed(() => new URL(requestUrl.pathname, config.public.siteUrl).toString())
useSeoMeta({
  description: 'Crée des billets personnalisés, vends tes entrées en FCFA et contrôle les accès par QR code avec TYPS.',
  ogType: 'website',
  ogSiteName: 'TYPS',
  ogLocale: 'fr_FR',
  ogTitle: 'TYPS — Ton événement. Ton ticket. Ton contrôle.',
  ogDescription: 'La billetterie événementielle pensée pour le Bénin et l’Afrique francophone.',
  ogUrl: () => canonicalUrl.value,
  twitterCard: 'summary'
})
useHead(() => ({ link: [{ rel: 'canonical', href: canonicalUrl.value }] }))
</script>
<template>
  <NuxtLayout><NuxtPage :transition="{ name: 'page', mode: 'out-in' }" /></NuxtLayout>
  <UiToaster />
</template>
