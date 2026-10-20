<script setup lang="ts">
import { LayoutDashboard, CalendarDays, Palette, Users, Wallet, Settings, ScanLine, ShieldCheck, LogOut, Menu, X, Bell, UserRound } from '@lucide/vue'
useHead({ meta: [{ name: 'robots', content: 'noindex, nofollow' }] })
const me = useMe(); const route = useRoute(); const { orgs, current, select } = useOrg(); const open = ref(false)
watch(() => route.fullPath, () => { open.value = false })
const isAdmin = computed(() => route.path.startsWith('/admin'))
const nav = computed(() => isAdmin.value
  ? [{ to: '/admin', label: 'Vue globale', icon: ShieldCheck }, { to: '/admin/users', label: 'Utilisateurs', icon: Users }, { to: '/admin/events', label: 'Événements', icon: CalendarDays }, { to: '/admin/finance', label: 'Paiements & frais', icon: Wallet }, { to: '/admin/features', label: 'Fonctionnalités', icon: Settings }, { to: '/admin/audit', label: 'Journal d’audit', icon: Settings }]
  : [{ to: '/app', label: 'Tableau de bord', icon: LayoutDashboard }, { to: '/app/events', label: 'Mes événements', icon: CalendarDays }, { to: '/app/studio', label: 'Studio de billets', icon: Palette }, { to: '/app/team', label: 'Équipe', icon: Users }, { to: '/app/payouts', label: 'Paiements', icon: Wallet }, { to: '/app/notifications', label: 'Notifications', icon: Bell }, { to: '/app/profile', label: 'Mon profil', icon: UserRound }, { to: '/app/settings', label: 'Paramètres', icon: Settings }, { to: '/scan', label: 'Scanner', icon: ScanLine }])
const active = (to: string) => (to === '/app' || to === '/admin' ? route.path === to : route.path.startsWith(to))
</script>
<template>
  <div class="min-h-dvh lg:grid lg:grid-cols-[260px_1fr]">
    <a href="#main" class="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[200] focus:rounded-lg focus:bg-accent focus:px-4 focus:py-2 focus:text-bg">Aller au contenu</a>
    <header class="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-line bg-bg/80 px-4 backdrop-blur-xl lg:hidden"><NuxtLink to="/"><LogoMark /></NuxtLink><button class="btn btn-ghost !min-h-[44px] px-3" :aria-expanded="open" aria-label="Menu" @click="open = !open"><component :is="open ? X : Menu" :size="20" /></button></header>
    <aside class="border-line bg-surface/50 lg:sticky lg:top-0 lg:h-dvh lg:border-r" :class="open ? 'block' : 'hidden lg:block'" aria-label="Navigation de l’espace">
      <div class="flex h-full flex-col gap-4 overflow-y-auto p-4">
        <NuxtLink to="/" class="hidden lg:block"><LogoMark /></NuxtLink>
        <div v-if="!isAdmin && orgs.length"><label class="label" for="orgsel">Organisation</label><select id="orgsel" class="input" :value="current?.id" @change="select(($event.target as HTMLSelectElement).value)"><option v-for="o in orgs" :key="o.id" :value="o.id">{{ o.name }}</option></select></div>
        <nav class="flex flex-1 flex-col gap-1"><NuxtLink v-for="n in nav" :key="n.to" :to="n.to" class="flex min-h-[44px] items-center gap-3 rounded-xl px-3 text-sm font-semibold transition" :class="active(n.to) ? 'bg-accent/15 text-accent' : 'text-muted hover:bg-line/40 hover:text-fg'"><component :is="n.icon" :size="18" />{{ n.label }}</NuxtLink>
          <NuxtLink v-if="me.user?.platformRole === 'admin' && !isAdmin" to="/admin" class="mt-2 flex min-h-[44px] items-center gap-3 rounded-xl px-3 text-sm font-semibold text-muted hover:bg-line/40"><ShieldCheck :size="18" />Administration TYPS</NuxtLink>
          <NuxtLink v-if="isAdmin" to="/app" class="mt-2 flex min-h-[44px] items-center gap-3 rounded-xl px-3 text-sm font-semibold text-muted hover:bg-line/40"><LayoutDashboard :size="18" />Espace organisateur</NuxtLink>
        </nav>
        <div class="space-y-2 border-t border-line pt-3"><ThemePicker /><p class="truncate text-xs text-muted">{{ me.user?.email }}</p><button class="btn btn-ghost w-full !min-h-[40px]" @click="logout"><LogOut :size="16" />Déconnexion</button></div>
      </div>
    </aside>
    <main id="main" class="min-w-0 p-4 sm:p-6 lg:p-8"><slot /></main>
  </div>
</template>
