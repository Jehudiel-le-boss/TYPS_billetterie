<script setup lang="ts">
definePageMeta({ layout: 'dashboard', middleware: 'auth' }); useSeoMeta({ title: 'Mes événements', robots: 'noindex' })
const route = useRoute()
const { current } = useOrg()
const me = useMe()
const canCreateEvents = computed(() => ['owner', 'manager'].includes(current.value?.role ?? '') || me.value.user?.platformRole === 'admin')
const { data, pending } = await useAsyncData('my-events', () => (current.value ? api<any[]>('/api/manage/events', { query: { orgId: current.value.id } }) : Promise.resolve([])), { watch: [() => current.value?.id], server: false })
const search = ref('')
const stages = [
  { key: 'all', title: 'Tous les événements', description: 'Vue d’ensemble de votre programmation.' },
  { key: 'draft', title: 'Brouillons', description: 'À compléter avant publication.' },
  { key: 'published', title: 'Événements publiés', description: 'Gérez la page, les ventes et le suivi.' },
  { key: 'closed', title: 'Terminés', description: 'Événements clôturés ou annulés.' }
] as const
function stageCount(stageKey: string) {
  const events = data.value ?? []
  if (stageKey === 'all') return events.length
  if (stageKey === 'draft') return events.filter((event) => event.status === 'draft').length
  if (stageKey === 'published') return events.filter((event) => ['published', 'suspended'].includes(event.status)).length
  return events.filter((event) => ['closed', 'cancelled'].includes(event.status)).length
}
const stage = computed(() => stages.some((item) => item.key === route.query.stage) ? String(route.query.stage) : 'all')
const selectedStage = computed(() => stages.find((item) => item.key === stage.value) ?? stages[0])
const filtered = computed(() => {
  const query = search.value.trim().toLocaleLowerCase('fr')
  return (data.value ?? []).filter((event) => {
    const matchesSearch = !query || event.title.toLocaleLowerCase('fr').includes(query)
    const matchesStage = stage.value === 'all'
      || (stage.value === 'draft' && event.status === 'draft')
      || (stage.value === 'published' && ['published', 'suspended'].includes(event.status))
      || (stage.value === 'closed' && ['closed', 'cancelled'].includes(event.status))
    return matchesSearch && matchesStage
  })
})
const statusLabel = (status: string) => ({ draft: 'Brouillon', published: 'Publié', suspended: 'Suspendu', closed: 'Clôturé', cancelled: 'Annulé' }[status] ?? status)
</script>
<template>
  <OrgOnboarding v-if="!current" />
  <div v-else class="space-y-6"><div class="flex flex-wrap items-center justify-between gap-3"><div><p class="text-sm font-semibold text-accent">Gestion événementielle</p><h1 class="mt-1 text-[clamp(1.8rem,4vw,2.6rem)] font-black">{{ selectedStage.title }}</h1><p class="mt-2 text-sm text-muted">{{ selectedStage.description }}</p></div><NuxtLink v-if="canCreateEvents" to="/app/events/new" class="btn btn-primary">Créer un événement</NuxtLink></div>
    <div v-if="pending" class="skeleton h-64" /><UiEmpty v-else-if="!data?.length" title="Aucun événement" text="Crée ton premier événement : titre, date, lieu et catégories de billets."><NuxtLink v-if="canCreateEvents" to="/app/events/new" class="btn btn-primary mt-2">Créer mon premier événement</NuxtLink></UiEmpty>
    <template v-else>
      <section class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Espaces de gestion des événements">
        <NuxtLink v-for="item in stages" :key="item.key" :to="{ path: '/app/events', query: item.key === 'all' ? {} : { stage: item.key } }" class="card block p-4 transition hover:border-accent/60 hover:bg-line/20" :class="stage === item.key ? 'border-accent/70 bg-accent/10' : ''" :aria-current="stage === item.key ? 'page' : undefined">
          <p class="text-sm font-semibold text-muted">{{ item.title }}</p><p class="mt-2 font-display text-3xl font-black">{{ stageCount(item.key) }}</p><p class="mt-1 text-xs text-muted">{{ item.description }}</p>
        </NuxtLink>
      </section>
      <section class="space-y-4">
        <div class="flex flex-wrap items-end justify-between gap-3"><div><h2 class="text-xl font-bold">{{ selectedStage.title }}</h2><p class="mt-1 text-sm text-muted">{{ filtered.length }} événement{{ filtered.length === 1 ? '' : 's' }}</p></div><label class="block w-full sm:max-w-xs"><span class="label">Rechercher dans cette liste</span><input v-model="search" type="search" class="input" placeholder="Nom de l’événement"></label></div>
      <UiEmpty v-if="!filtered.length" title="Aucun résultat" text="Essaie une autre recherche ou modifie le filtre de statut." />
        <div class="grid gap-3 lg:grid-cols-2"><NuxtLink v-for="event in filtered" :key="event.id" :to="`/app/events/${event.id}`" class="card block space-y-3 p-4 transition hover:border-accent/50 hover:bg-line/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"><div class="flex items-start justify-between gap-3"><div class="min-w-0"><h3 class="break-words font-bold">{{ event.title }}</h3><span v-if="event.isDemo" class="chip mt-2 text-amber-300">Démo</span></div><span class="chip shrink-0" :class="event.status === 'published' ? 'text-emerald-300' : event.status === 'draft' ? 'text-amber-200' : ''">{{ statusLabel(event.status) }}</span></div><div class="flex flex-wrap justify-between gap-x-3 gap-y-1 text-sm text-muted"><span>{{ fdate(event.startsAt, { dateStyle: 'medium', timeStyle: 'short' }) }}</span><span>{{ event.sold }} / {{ event.capacity }} vendus</span></div><span class="text-sm font-semibold text-accent">Gérer l’événement →</span></NuxtLink></div>
      </section>
    </template>
  </div>
</template>
