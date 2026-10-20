<script setup lang="ts">
import { Plus, ScanLine, Ticket } from '@lucide/vue'
definePageMeta({ layout: 'dashboard', middleware: 'auth' }); useSeoMeta({ title: 'Tableau de bord', robots: 'noindex' })
const { current } = useOrg(); const me = useMe()
const { data: d, pending } = await useAsyncData('dash', () => (current.value ? api<any>('/api/orgs/dashboard', { query: { orgId: current.value.id } }).catch(() => null) : Promise.resolve(null)), { watch: [() => current.value?.id], server: false })
</script>
<template>
  <OrgOnboarding v-if="!current" />
  <div v-else class="space-y-8">
    <div class="flex flex-wrap items-end justify-between gap-4"><div><p class="text-sm text-muted">Bonjour {{ me.user?.fullName?.split(' ')[0] }}</p><h1 class="text-[clamp(1.8rem,4vw,2.8rem)] font-black">{{ current.name }}</h1></div>
      <div class="flex flex-wrap gap-2"><NuxtLink to="/app/events/new" data-guide="organizer-create-event" class="btn btn-primary"><Plus :size="16" />Créer un événement</NuxtLink><NuxtLink to="/app/events" class="btn btn-ghost"><Ticket :size="16" />Vendre un billet</NuxtLink><NuxtLink to="/scan" class="btn btn-ghost"><ScanLine :size="16" />Ouvrir le scanner</NuxtLink></div></div>
    <p v-if="me.user && !me.user.emailVerified" class="rounded-xl border border-amber-400/40 bg-amber-400/10 p-3 text-sm text-amber-100">Confirme ton adresse e-mail via le lien reçu pour sécuriser ton compte.</p>
    <div v-if="pending || !d" class="grid gap-4 sm:grid-cols-4"><div v-for="n in 4" :key="n" class="skeleton h-28" /></div>
    <template v-else>
      <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><div class="card p-5"><p class="text-sm text-muted">Revenus (hors démo)</p><p class="mt-1 font-display text-2xl font-black">{{ money(d.totals.revenue, current.currency) }}</p></div><div class="card p-5"><p class="text-sm text-muted">Commandes payées</p><p class="mt-1 font-display text-2xl font-black">{{ d.totals.orders }}</p></div><div class="card p-5"><p class="text-sm text-muted">Billets émis</p><p class="mt-1 font-display text-2xl font-black">{{ d.totals.tickets }}</p></div><div class="card p-5"><p class="text-sm text-muted">Entrées validées</p><p class="mt-1 font-display text-2xl font-black">{{ d.totals.entries }}</p></div></div>
      <div v-if="d.alerts.length" class="space-y-2"><div v-for="a in d.alerts" :key="a.kind" class="rounded-xl border border-amber-400/40 bg-amber-400/10 p-3 text-sm text-amber-100">{{ a.kind === 'refund' ? `${a.n} demande(s) de remboursement à traiter` : `${a.n} événement(s) en brouillon à publier` }}</div></div>
      <div class="grid gap-6 lg:grid-cols-[1.4fr_1fr]"><div class="card p-5"><h2 class="mb-4 text-lg font-bold">Revenus sur 30 jours</h2><BarChart :items="d.revenue30" :format="(n: number) => money(n, current!.currency)" empty="Aucune vente payée sur 30 jours" /></div>
        <div class="card p-5"><h2 class="mb-4 text-lg font-bold">Prochains événements</h2><ul v-if="d.upcoming.length" class="divide-y divide-line"><li v-for="e in d.upcoming" :key="e.id"><NuxtLink :to="`/app/events/${e.id}`" class="flex items-center justify-between gap-3 py-3 hover:text-accent"><div class="min-w-0"><p class="truncate font-semibold">{{ e.title }}</p><p class="text-xs text-muted">{{ fdate(e.starts_at, { dateStyle: 'medium' }) }} · {{ e.sold }}/{{ e.capacity }} vendus</p></div><span class="chip capitalize">{{ e.status }}</span></NuxtLink></li></ul><UiEmpty v-else title="Aucun événement à venir" text="Crée ton premier événement en quelques minutes." /></div></div>
    </template>
  </div>
</template>
