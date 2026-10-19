<script setup lang="ts">
definePageMeta({ layout: 'dashboard', middleware: 'auth' }); useSeoMeta({ title: 'Mes événements', robots: 'noindex' })
const { current } = useOrg()
const { data, pending } = await useAsyncData('my-events', () => (current.value ? api<any[]>('/api/manage/events', { query: { orgId: current.value.id } }) : Promise.resolve([])), { watch: [() => current.value?.id], server: false })
</script>
<template>
  <OrgOnboarding v-if="!current" />
  <div v-else class="space-y-6"><div class="flex flex-wrap items-center justify-between gap-3"><h1 class="text-[clamp(1.8rem,4vw,2.6rem)] font-black">Mes événements</h1><NuxtLink to="/app/events/new" class="btn btn-primary">Créer un événement</NuxtLink></div>
    <div v-if="pending" class="skeleton h-64" /><UiEmpty v-else-if="!data?.length" title="Aucun événement" text="Crée ton premier événement : titre, date, lieu et catégories de billets."><NuxtLink to="/app/events/new" class="btn btn-primary mt-2">Créer mon premier événement</NuxtLink></UiEmpty>
    <div v-else class="card overflow-x-auto"><table class="w-full min-w-[640px]"><thead><tr><th class="th">Événement</th><th class="th">Date</th><th class="th">Statut</th><th class="th">Vendus</th></tr></thead><tbody class="divide-y divide-line"><tr v-for="e in data" :key="e.id" class="transition hover:bg-line/30"><td class="td"><NuxtLink :to="`/app/events/${e.id}`" class="font-semibold hover:text-accent">{{ e.title }}</NuxtLink><span v-if="e.isDemo" class="chip ml-2 text-amber-300">démo</span></td><td class="td text-muted">{{ fdate(e.startsAt, { dateStyle: 'medium', timeStyle: 'short' }) }}</td><td class="td"><span class="chip capitalize">{{ e.status }}</span></td><td class="td">{{ e.sold }} / {{ e.capacity }}</td></tr></tbody></table></div></div>
</template>
