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
const can = (p: string) => { const a = ev.value?.access; if (!a) return false; if (a.platformAdmin) return true; const r = a.orgRole; const m: Record<string, string[]> = { owner: ['all'], manager: ['all'], seller: ['sales', 'door', 'scan'], viewer: ['sales', 'stats'], agent: ['scan'] }; return !!r && (m[r]?.includes('all') || m[r]?.includes(p)) }
const assignedStaffOnly = computed(() => !!ev.value?.access?.staff && !ev.value.access.platformAdmin && !['owner', 'manager'].includes(ev.value.access.orgRole ?? ''))
const canScanEvent = computed(() => can('scan') || !!ev.value?.access?.staff?.canScan)
const canSellEvent = computed(() => can('door') || !!ev.value?.access?.staff?.canSell)
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
const selectedTabLabel = computed(() => tabs.value.find((item) => item.key === selectedTab.value)?.label ?? '')
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
async function selectTab(value: string) {
  if (!tabs.value.some((item) => item.key === value)) return
  await navigateTo({ query: { ...route.query, tab: value } }, { replace: true })
}
</script>
<template>
  <div v-if="error"><UiEmpty title="Événement introuvable" text="Il n’existe pas ou vous n’y avez pas accès." /></div>
  <div v-else-if="!ev" class="space-y-4"><div class="skeleton h-12 w-80" /><div class="skeleton h-96" /></div>
  <div v-else>
    <NuxtLink to="/app/events" class="text-sm text-muted hover:text-fg">← Mes événements</NuxtLink>
    <div class="mt-2 flex flex-wrap items-center justify-between gap-3"><div><h1 class="text-[clamp(1.6rem,3.5vw,2.4rem)] font-black">{{ ev.title }}</h1><p class="mt-1 text-sm text-muted">{{ fdate(ev.startsAt) }} · <span class="chip capitalize">{{ ev.status === 'draft' ? 'brouillon' : ev.status === 'published' ? 'publié' : ev.status }}</span><span v-if="ev.isDemo" class="chip ml-1 text-amber-300">démo</span></p></div><div class="flex gap-2"><NuxtLink :to="previewUrl" target="_blank" class="btn btn-ghost">Aperçu</NuxtLink><NuxtLink v-if="canScanEvent" :to="`/scan/${ev.id}`" class="btn btn-ghost">Scanner</NuxtLink></div></div>
    <section v-if="assignedStaffOnly" class="mt-5 rounded-2xl border border-accent/30 bg-accent/5 p-4 sm:p-5"><h2 class="font-bold">Ton accès à cet événement</h2><p class="mt-1 text-sm text-muted">Tu vois cet événement parce que tu y as un accès. Les actions disponibles dépendent de ton rôle et des droits d’affectation.</p><div class="mt-4 flex flex-wrap gap-2"><NuxtLink v-if="canScanEvent" :to="`/scan/${ev.id}`" class="btn btn-primary">Scanner les billets</NuxtLink><NuxtLink v-if="canSellEvent" :to="{ query: { ...route.query, tab: 'guichet' } }" class="btn btn-primary">Ouvrir le guichet</NuxtLink><NuxtLink to="/scan" class="btn btn-ghost">Mes affectations</NuxtLink></div></section>
    <p v-if="ev.status === 'draft'" class="mt-4 rounded-xl border border-amber-400/30 bg-amber-400/10 p-3 text-sm text-amber-100">Cet événement est un brouillon : seules les personnes disposant du lien privé peuvent en voir l’aperçu. Les sections de ventes et de suivi apparaîtront après publication. Publie-le depuis « Aperçu » lorsque les informations sont prêtes.</p>
    <p v-else-if="ev.status === 'published'" class="mt-4 rounded-xl border border-emerald-400/30 bg-emerald-400/10 p-3 text-sm text-emerald-100">Cet événement est publié. Les réglages de l’événement, les billets, les ventes et le suivi sont regroupés dans des sections distinctes.</p>
    <div class="mt-5 grid gap-5 lg:grid-cols-[220px_minmax(0,1fr)] lg:items-start">
      <aside class="hidden space-y-5 rounded-2xl border border-line bg-surface/50 p-3 lg:block" aria-label="Navigation des outils de l’événement">
        <section v-for="group in tabGroups" :key="group.name" class="space-y-1">
          <h2 class="px-3 pb-1 text-xs font-bold uppercase tracking-wide text-muted">{{ group.name }}</h2>
          <NuxtLink v-for="item in group.tabs" :key="item.key" :to="{ query: { ...route.query, tab: item.key } }" replace class="flex min-h-10 items-center rounded-lg px-3 text-sm font-semibold transition" :class="selectedTab === item.key ? 'bg-accent/15 text-accent' : 'text-muted hover:bg-line/40 hover:text-fg'">{{ item.label }}</NuxtLink>
        </section>
      </aside>
      <div class="min-w-0 space-y-4">
        <div class="flex flex-wrap items-center justify-between gap-3"><h2 class="text-xl font-bold">{{ selectedTabLabel }}</h2><label class="block w-full lg:hidden"><span class="label">Section de l’événement</span><select class="input" :value="selectedTab" @change="selectTab(($event.target as HTMLSelectElement).value)"><optgroup v-for="group in tabGroups" :key="group.name" :label="group.name"><option v-for="item in group.tabs" :key="item.key" :value="item.key">{{ item.label }}</option></optgroup></select></label></div>
        <div v-if="hasOverview" class="sticky bottom-2 z-30 flex items-center justify-between gap-3 rounded-xl border border-line bg-surface/95 p-3 shadow-lg backdrop-blur"><p class="text-sm" :class="overviewDirty ? 'font-semibold text-amber-200' : 'text-muted'">{{ overviewDirty ? 'Informations modifiées' : 'Informations à jour' }}</p><button type="button" class="btn btn-primary shrink-0" :disabled="!overviewDirty || overviewSaving" @click="submitOverview">{{ overviewSaving ? 'Enregistrement…' : overviewDirty ? 'Enregistrer' : 'À jour' }}</button></div>
        <EvOverview v-if="hasOverview" v-show="selectedTab === 'apercu'" :ev="ev" @refresh="refresh" @dirty-change="overviewDirty = $event" @saving-change="overviewSaving = $event" />
        <EvCategories v-if="selectedTab === 'billets'" :ev="ev" @refresh="refresh" />
        <EvOrders v-if="selectedTab === 'commandes'" :ev="ev" />
        <EvAttendees v-if="selectedTab === 'participants'" :ev="ev" />
        <EvGuests v-if="selectedTab === 'invites'" :ev="ev" />
        <EvPromos v-if="selectedTab === 'promos'" :ev="ev" />
        <EvDoor v-if="selectedTab === 'guichet'" :ev="ev" @refresh="refresh" />
        <EvStaff v-if="selectedTab === 'equipe'" :ev="ev" />
        <EvStats v-if="selectedTab === 'stats'" :ev="ev" />
        <EvLive v-if="selectedTab === 'direct'" :ev="ev" />
      </div>
    </div>
  </div>
</template>
