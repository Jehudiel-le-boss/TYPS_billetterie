<script setup lang="ts">
definePageMeta({ layout: 'dashboard', middleware: 'auth' })
const route = useRoute(); const id = String(route.params.id); const tab = computed(() => String(route.query.tab ?? 'apercu'))
const { data: ev, error, refresh } = await useAsyncData(`mev-${id}`, () => api<any>(`/api/manage/events/${id}`), { server: false })
useSeoMeta({ title: () => ev.value?.title ?? 'Événement', robots: 'noindex' })
const previewUrl = computed(() => {
  if (!ev.value) return '/app/events'
  const publicPublished = ev.value.status === 'published' && ev.value.visibility === 'public' && ev.value.moderation === 'ok'
  return `/events/${ev.value.slug}${publicPublished ? '' : `?k=${encodeURIComponent(ev.value.shareToken)}`}`
})
const can = (p: string) => { const a = ev.value?.access; if (!a) return false; if (a.platformAdmin) return true; const r = a.orgRole; const m: Record<string, string[]> = { owner: ['all'], manager: ['all'], seller: ['sales', 'door'], viewer: ['sales', 'stats'], agent: [] }; return !!r && (m[r]?.includes('all') || m[r]?.includes(p)) }
const tabs = computed(() => [
  { key: 'apercu', label: 'Aperçu', group: 'Gestion', permission: 'all' },
  { key: 'billets', label: 'Billets', group: 'Gestion', permission: 'all' },
  { key: 'invites', label: 'Invités', group: 'Gestion', permission: 'all' },
  { key: 'promos', label: 'Promos', group: 'Gestion', permission: 'all' },
  { key: 'equipe', label: 'Équipe', group: 'Gestion', permission: 'all' },
  { key: 'commandes', label: 'Commandes', group: 'Ventes', permission: 'sales' },
  { key: 'participants', label: 'Participants', group: 'Ventes', permission: 'sales' },
  { key: 'guichet', label: 'Guichet', group: 'Ventes', permission: 'door' },
  { key: 'stats', label: 'Statistiques', group: 'Suivi', permission: 'stats' },
  { key: 'direct', label: 'En direct', group: 'Suivi', permission: 'all' }
].filter((item) => {
  if (ev.value?.status === 'draft' && ['commandes', 'participants', 'guichet', 'stats', 'direct'].includes(item.key)) return false
  if (item.key === 'direct' && ev.value?.status !== 'published') return false
  return can(item.permission) || (ev.value?.access?.staff?.canSell && item.key === 'guichet')
}))
const tabGroups = computed(() => ['Gestion', 'Ventes', 'Suivi'].map((group) => ({ name: group, tabs: tabs.value.filter((item) => item.group === group) })).filter((group) => group.tabs.length))
const selectedTab = computed(() => tabs.value.some((item) => item.key === tab.value) ? tab.value : tabs.value[0]?.key ?? '')
const hasOverview = computed(() => tabs.value.some((item) => item.key === 'apercu'))
const overviewDirty = ref(false)
const overviewSaving = ref(false)
async function submitOverview() {
  if (selectedTab.value !== 'apercu') {
    await navigateTo({ query: { ...route.query, tab: 'apercu' } })
    await nextTick()
  }
  const form = document.getElementById('event-overview-form')
  if (form instanceof HTMLFormElement) form.requestSubmit()
}
</script>
<template>
  <div v-if="error"><UiEmpty title="Événement introuvable" text="Il n’existe pas ou vous n’y avez pas accès." /></div>
  <div v-else-if="!ev" class="space-y-4"><div class="skeleton h-12 w-80" /><div class="skeleton h-96" /></div>
  <div v-else>
    <NuxtLink to="/app/events" class="text-sm text-muted hover:text-fg">← Mes événements</NuxtLink>
    <div class="mt-2 flex flex-wrap items-center justify-between gap-3"><div><h1 class="text-[clamp(1.6rem,3.5vw,2.4rem)] font-black">{{ ev.title }}</h1><p class="mt-1 text-sm text-muted">{{ fdate(ev.startsAt) }} · <span class="chip capitalize">{{ ev.status === 'draft' ? 'brouillon' : ev.status === 'published' ? 'publié' : ev.status }}</span><span v-if="ev.isDemo" class="chip ml-1 text-amber-300">démo</span></p></div><div class="flex gap-2"><NuxtLink :to="previewUrl" target="_blank" class="btn btn-ghost">Aperçu</NuxtLink><NuxtLink v-if="can('door') || ev.access?.staff?.canScan" :to="`/scan/${ev.id}`" class="btn btn-ghost">Scanner</NuxtLink></div></div>
    <p v-if="ev.status === 'draft'" class="mt-4 rounded-xl border border-amber-400/30 bg-amber-400/10 p-3 text-sm text-amber-100">Cet événement est un brouillon : seules les personnes disposant du lien privé peuvent en voir l’aperçu. Les sections de ventes et de suivi apparaîtront après publication. Publie-le depuis « Aperçu » lorsque les informations sont prêtes.</p>
    <p v-else-if="ev.status === 'published'" class="mt-4 rounded-xl border border-emerald-400/30 bg-emerald-400/10 p-3 text-sm text-emerald-100">Cet événement est publié. Les réglages de l’événement, les billets, les ventes et le suivi sont regroupés dans des sections distinctes.</p>
    <nav class="mt-5 space-y-3" aria-label="Sections de l’événement"><div v-for="group in tabGroups" :key="group.name" class="flex flex-wrap items-center gap-1 border-b border-line pb-2"><span class="mr-2 min-w-fit text-xs font-bold uppercase tracking-wide text-muted">{{ group.name }}</span><NuxtLink v-for="item in group.tabs" :key="item.key" :to="{ query: { tab: item.key } }" replace class="whitespace-nowrap rounded-lg px-3 py-2 text-sm font-semibold transition" :class="selectedTab === item.key ? 'bg-accent/15 text-accent' : 'text-muted hover:bg-line/40 hover:text-fg'">{{ item.label }}</NuxtLink></div></nav>
    <div v-if="hasOverview" class="sticky bottom-2 z-30 mt-3 flex items-center justify-between gap-3 rounded-xl border border-line bg-surface/95 p-3 shadow-lg backdrop-blur"><p class="text-sm" :class="overviewDirty ? 'font-semibold text-amber-200' : 'text-muted'">{{ overviewDirty ? 'Modifications non enregistrées' : 'Informations générales enregistrées' }}</p><button type="button" class="btn btn-primary shrink-0" :disabled="!overviewDirty || overviewSaving" @click="submitOverview">{{ overviewSaving ? 'Enregistrement…' : 'Enregistrer les infos' }}</button></div>
    <div class="mt-5">
      <EvOverview v-if="hasOverview" v-show="selectedTab === 'apercu'" :ev="ev" @refresh="refresh" @dirty-change="overviewDirty = $event" @saving-change="overviewSaving = $event" />
      <EvCategories v-else-if="selectedTab === 'billets'" :ev="ev" @refresh="refresh" />
      <EvOrders v-else-if="selectedTab === 'commandes'" :ev="ev" />
      <EvAttendees v-else-if="selectedTab === 'participants'" :ev="ev" />
      <EvGuests v-else-if="selectedTab === 'invites'" :ev="ev" />
      <EvPromos v-else-if="selectedTab === 'promos'" :ev="ev" />
      <EvDoor v-else-if="selectedTab === 'guichet'" :ev="ev" @refresh="refresh" />
      <EvStaff v-else-if="selectedTab === 'equipe'" :ev="ev" />
      <EvStats v-else-if="selectedTab === 'stats'" :ev="ev" />
      <EvLive v-else-if="selectedTab === 'direct'" :ev="ev" />
    </div>
  </div>
</template>
