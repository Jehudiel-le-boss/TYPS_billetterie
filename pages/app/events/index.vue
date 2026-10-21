<script setup lang="ts">
definePageMeta({ layout: 'dashboard', middleware: 'auth' }); useSeoMeta({ title: 'Mes événements', robots: 'noindex' })
const { current } = useOrg()
const me = useMe()
const canCreateEvents = computed(() => ['owner', 'manager'].includes(current.value?.role ?? '') || me.value.user?.platformRole === 'admin')
const { data, pending } = await useAsyncData('my-events', () => (current.value ? api<any[]>('/api/manage/events', { query: { orgId: current.value.id } }) : Promise.resolve([])), { watch: [() => current.value?.id], server: false })
const search = ref('')
const stage = ref('all')
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
const sections = computed(() => [
  { key: 'draft', title: 'Brouillons', note: 'À préparer avant publication', items: filtered.value.filter((event) => event.status === 'draft') },
  { key: 'published', title: 'Événements publiés', note: 'En ligne ou temporairement suspendus', items: filtered.value.filter((event) => ['published', 'suspended'].includes(event.status)) },
  { key: 'closed', title: 'Événements terminés', note: 'Clôturés ou annulés', items: filtered.value.filter((event) => ['closed', 'cancelled'].includes(event.status)) }
].filter((section) => section.items.length))
const statusLabel = (status: string) => ({ draft: 'Brouillon', published: 'Publié', suspended: 'Suspendu', closed: 'Clôturé', cancelled: 'Annulé' }[status] ?? status)
</script>
<template>
  <OrgOnboarding v-if="!current" />
  <div v-else class="space-y-6"><div class="flex flex-wrap items-center justify-between gap-3"><h1 class="text-[clamp(1.8rem,4vw,2.6rem)] font-black">Mes événements</h1><NuxtLink v-if="canCreateEvents" to="/app/events/new" class="btn btn-primary">Créer un événement</NuxtLink></div>
    <div v-if="pending" class="skeleton h-64" /><UiEmpty v-else-if="!data?.length" title="Aucun événement" text="Crée ton premier événement : titre, date, lieu et catégories de billets."><NuxtLink v-if="canCreateEvents" to="/app/events/new" class="btn btn-primary mt-2">Créer mon premier événement</NuxtLink></UiEmpty>
    <template v-else>
      <section class="card grid gap-3 p-4 sm:grid-cols-[1fr_220px] sm:items-end"><label class="block"><span class="label">Rechercher</span><input v-model="search" type="search" class="input" placeholder="Nom de l’événement"></label><label class="block"><span class="label">Afficher</span><select v-model="stage" class="input"><option value="all">Tous les statuts</option><option value="draft">Brouillons</option><option value="published">Publiés</option><option value="closed">Terminés</option></select></label></section>
      <p class="text-sm text-muted">{{ filtered.length }} événement{{ filtered.length === 1 ? '' : 's' }} trouvé{{ filtered.length === 1 ? '' : 's' }}</p>
      <UiEmpty v-if="!filtered.length" title="Aucun résultat" text="Essaie une autre recherche ou modifie le filtre de statut." />
      <section v-for="section in sections" :key="section.key" class="space-y-3"><div><h2 class="text-xl font-bold">{{ section.title }} <span class="text-sm font-medium text-muted">({{ section.items.length }})</span></h2><p class="mt-1 text-sm text-muted">{{ section.note }}</p></div>
        <div class="grid gap-3 lg:grid-cols-2"><NuxtLink v-for="event in section.items" :key="event.id" :to="`/app/events/${event.id}`" class="card block space-y-3 p-4 transition hover:border-accent/50 hover:bg-line/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"><div class="flex items-start justify-between gap-3"><div class="min-w-0"><h3 class="break-words font-bold">{{ event.title }}</h3><span v-if="event.isDemo" class="chip mt-2 text-amber-300">Démo</span></div><span class="chip shrink-0" :class="event.status === 'published' ? 'text-emerald-300' : event.status === 'draft' ? 'text-amber-200' : ''">{{ statusLabel(event.status) }}</span></div><div class="flex flex-wrap justify-between gap-x-3 gap-y-1 text-sm text-muted"><span>{{ fdate(event.startsAt, { dateStyle: 'medium', timeStyle: 'short' }) }}</span><span>{{ event.sold }} / {{ event.capacity }} vendus</span></div><span class="text-sm font-semibold text-accent">Gérer l’événement →</span></NuxtLink></div>
      </section>
    </template>
  </div>
</template>
