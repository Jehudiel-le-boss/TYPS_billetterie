<script setup lang="ts">
definePageMeta({ layout: 'scan', middleware: 'auth' }); useSeoMeta({ title: 'Scanner', robots: 'noindex' })
const { data, pending } = await useAsyncData('scan-events', () => api<any[]>('/api/scan/events').catch(() => []), { server: false })
</script>
<template>
  <div class="mx-auto max-w-xl px-4 py-8"><NuxtLink to="/" aria-label="TYPS"><LogoMark /></NuxtLink><h1 class="mt-8 text-3xl font-black">Contrôle des entrées</h1><p class="mt-2 text-muted">Choisis l’événement à contrôler. Seuls les événements auxquels tu es affecté apparaissent.</p>
    <div v-if="pending" class="mt-6 space-y-3"><div v-for="n in 3" :key="n" class="skeleton h-20" /></div><UiEmpty v-else-if="!data?.length" data-guide="agent-invitation" class="mt-6" title="Aucun événement à contrôler" text="Demande à l’organisateur de t’affecter à un événement avec ton adresse e-mail." />
    <ul v-else data-guide="agent-events" class="mt-6 space-y-3"><li v-for="e in data" :key="e.id"><NuxtLink :to="`/scan/${e.id}`" class="card flex min-h-[72px] items-center justify-between gap-3 p-4 transition hover:border-accent"><div><p class="font-display text-lg font-bold">{{ e.title }}</p><p class="text-sm text-muted">{{ fdate(e.startsAt, { dateStyle: 'medium', timeStyle: 'short' }) }}{{ e.venue ? ` · ${e.venue}` : '' }}</p></div><span class="btn btn-primary !min-h-[40px]">Scanner</span></NuxtLink></li></ul></div>
</template>
