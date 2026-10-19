<script setup lang="ts">
import { Menu, X, LayoutDashboard, ScanLine } from '@lucide/vue'
const me = useMe(); const open = ref(false); const route = useRoute()
watch(() => route.fullPath, () => { open.value = false })
const links = [{ to: '/events', label: 'Explorer' }, { to: '/#roles', label: 'Acheter ou vendre' }, { to: '/#scanner', label: 'Scanner' }, { to: '/#faq', label: 'FAQ' }]
</script>
<template>
  <header class="sticky top-0 z-40 border-b border-line/60 bg-bg/70 backdrop-blur-xl">
    <div class="container-x flex h-16 items-center justify-between gap-4">
      <NuxtLink to="/" aria-label="TYPS, accueil"><LogoMark /></NuxtLink>
      <nav class="hidden items-center gap-1 md:flex" aria-label="Navigation principale"><NuxtLink v-for="l in links" :key="l.to" :to="l.to" class="rounded-full px-3.5 py-2 text-sm font-semibold text-muted transition hover:text-fg">{{ l.label }}</NuxtLink></nav>
      <div class="hidden items-center gap-2 md:flex">
        <ThemePicker />
        <template v-if="me.user"><NuxtLink to="/scan" class="btn btn-ghost !min-h-[40px] px-3"><ScanLine :size="16" />Scanner</NuxtLink><NuxtLink to="/app" class="btn btn-primary !min-h-[40px]"><LayoutDashboard :size="16" />Mon espace</NuxtLink></template>
        <template v-else><NuxtLink to="/auth/login" class="btn btn-ghost !min-h-[40px]">Connexion</NuxtLink><NuxtLink to="/auth/register" class="btn btn-primary !min-h-[40px]">Créer mon compte</NuxtLink></template>
      </div>
      <button class="btn btn-ghost !min-h-[44px] px-3 md:hidden" :aria-expanded="open" aria-label="Menu" @click="open = !open"><component :is="open ? X : Menu" :size="20" /></button>
    </div>
    <div v-if="open" class="container-x space-y-2 pb-4 md:hidden">
      <NuxtLink v-for="l in links" :key="l.to" :to="l.to" class="block rounded-xl px-3 py-3 font-semibold hover:bg-line/50">{{ l.label }}</NuxtLink>
      <div class="flex flex-wrap gap-2 pt-2"><ThemePicker /><template v-if="me.user"><NuxtLink to="/app" class="btn btn-primary">Mon espace</NuxtLink></template><template v-else><NuxtLink to="/auth/login" class="btn btn-ghost">Connexion</NuxtLink><NuxtLink to="/auth/register" class="btn btn-primary">Créer mon compte</NuxtLink></template></div>
    </div>
  </header>
</template>
