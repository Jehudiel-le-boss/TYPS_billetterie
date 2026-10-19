<script setup lang="ts">
definePageMeta({ layout: 'dashboard', middleware: 'auth' })
const route = useRoute(); const id = String(route.params.id); const tab = computed(() => String(route.query.tab ?? 'apercu'))
const { data: ev, error, refresh } = await useAsyncData(`mev-${id}`, () => api<any>(`/api/manage/events/${id}`), { server: false })
useSeoMeta({ title: () => ev.value?.title ?? 'Événement', robots: 'noindex' })
const can = (p: string) => { const a = ev.value?.access; if (!a) return false; if (a.platformAdmin) return true; const r = a.orgRole; const m: Record<string, string[]> = { owner: ['all'], manager: ['all'], seller: ['sales', 'door'], viewer: ['sales', 'stats'], agent: [] }; return !!r && (m[r]?.includes('all') || m[r]?.includes(p)) }
const tabs = computed(() => [['apercu', 'Aperçu', 'all'], ['billets', 'Billets', 'all'], ['commandes', 'Commandes', 'sales'], ['participants', 'Participants', 'sales'], ['invites', 'Invités', 'all'], ['promos', 'Promos', 'all'], ['guichet', 'Guichet', 'door'], ['equipe', 'Équipe', 'all'], ['stats', 'Statistiques', 'stats'], ['direct', 'En direct', 'all']].filter((t) => can(t[2]!) || (ev.value?.access?.staff?.canSell && t[0] === 'guichet')))
</script>
<template>
  <div v-if="error"><UiEmpty title="Événement introuvable" text="Il n’existe pas ou vous n’y avez pas accès." /></div>
  <div v-else-if="!ev" class="space-y-4"><div class="skeleton h-12 w-80" /><div class="skeleton h-96" /></div>
  <div v-else>
    <NuxtLink to="/app/events" class="text-sm text-muted hover:text-fg">← Mes événements</NuxtLink>
    <div class="mt-2 flex flex-wrap items-center justify-between gap-3"><div><h1 class="text-[clamp(1.6rem,3.5vw,2.4rem)] font-black">{{ ev.title }}</h1><p class="mt-1 text-sm text-muted">{{ fdate(ev.startsAt) }} · <span class="chip capitalize">{{ ev.status }}</span><span v-if="ev.isDemo" class="chip ml-1 text-amber-300">démo</span></p></div><div class="flex gap-2"><NuxtLink :to="`/events/${ev.slug}${ev.visibility === 'public' ? '' : '?k=' + ev.shareToken}`" target="_blank" class="btn btn-ghost">Voir la page</NuxtLink><NuxtLink :to="`/scan/${ev.id}`" class="btn btn-ghost">Scanner</NuxtLink></div></div>
    <nav class="mt-6 flex gap-1 overflow-x-auto border-b border-line pb-px" aria-label="Sections de l’événement"><NuxtLink v-for="t in tabs" :key="t[0]" :to="{ query: { tab: t[0] } }" replace class="whitespace-nowrap border-b-2 px-4 py-3 text-sm font-semibold transition" :class="tab === t[0] ? 'border-accent text-accent' : 'border-transparent text-muted hover:text-fg'">{{ t[1] }}</NuxtLink></nav>
    <div class="mt-6">
      <EvOverview v-if="tab === 'apercu'" :ev="ev" @refresh="refresh" /><EvCategories v-else-if="tab === 'billets'" :ev="ev" @refresh="refresh" /><EvOrders v-else-if="tab === 'commandes'" :ev="ev" /><EvAttendees v-else-if="tab === 'participants'" :ev="ev" /><EvGuests v-else-if="tab === 'invites'" :ev="ev" /><EvPromos v-else-if="tab === 'promos'" :ev="ev" /><EvDoor v-else-if="tab === 'guichet'" :ev="ev" @refresh="refresh" /><EvStaff v-else-if="tab === 'equipe'" :ev="ev" /><EvStats v-else-if="tab === 'stats'" :ev="ev" /><EvLive v-else-if="tab === 'direct'" :ev="ev" />
    </div>
  </div>
</template>
