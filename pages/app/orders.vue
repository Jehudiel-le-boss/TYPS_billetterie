<script setup lang="ts">
definePageMeta({ layout: 'dashboard', middleware: 'auth' })
useSeoMeta({ title: 'Mes achats', robots: 'noindex' })

interface BuyerOrder {
  id: string
  status: 'pending' | 'paid' | 'failed' | 'expired' | 'cancelled' | 'refunded' | 'partially_refunded'
  total: number
  currency: string
  createdAt: string
  paidAt: string | null
  eventTitle: string
  startsAt: string
  ticketCount: number
}
interface OrdersPage { items: BuyerOrder[]; hasMore: boolean; page: number }

const me = useMe()
const items = ref<BuyerOrder[]>([])
const page = ref(0)
const hasMore = ref(false)
const pending = ref(true)
const busy = ref(false)
const error = ref('')

async function loadMore() {
  if (!me.value.user?.emailVerified || busy.value || (!hasMore.value && page.value > 0)) return
  busy.value = true
  error.value = ''
  try {
    const nextPage = page.value + 1
    const result = await api<OrdersPage>('/api/me/orders', { query: { page: nextPage } })
    items.value.push(...result.items)
    page.value = result.page
    hasMore.value = result.hasMore
  } catch (e) {
    error.value = errMsg(e)
  } finally {
    pending.value = false
    busy.value = false
  }
}

onMounted(() => { if (me.value.user?.emailVerified) loadMore() })

const statusLabel: Record<BuyerOrder['status'], string> = {
  pending: 'Paiement en attente',
  paid: 'Payée',
  failed: 'Échec du paiement',
  expired: 'Réservation expirée',
  cancelled: 'Annulée',
  refunded: 'Remboursée',
  partially_refunded: 'Partiellement remboursée'
}
</script>

<template>
  <section>
    <p class="text-sm font-semibold text-accent">Espace acheteur</p>
    <h1 data-guide="buyer-history" class="mt-1 text-[clamp(1.8rem,4vw,2.8rem)] font-black">Mes achats</h1>
    <p class="mt-2 text-sm text-muted">Retrouve ici les commandes passées avec ton adresse vérifiée : {{ me.user?.email }}</p>

    <div v-if="!me.user?.emailVerified" class="mt-6 rounded-xl border border-amber-400/40 bg-amber-400/10 p-4 text-sm text-amber-100" role="status">
      Vérifie l’adresse e-mail de ton compte pour afficher les commandes qui lui sont associées.
    </div>
    <div v-else-if="pending && !items.length" class="mt-6 space-y-3" aria-label="Chargement des achats">
      <div v-for="n in 3" :key="n" class="skeleton h-28" />
    </div>
    <div v-else-if="error && !items.length" class="mt-6 rounded-xl border border-red-400/30 bg-red-400/10 p-4 text-sm text-red-200" role="alert">
      {{ error }}
      <button type="button" class="ml-2 underline" @click="loadMore">Réessayer</button>
    </div>
    <ul v-else-if="items.length" class="mt-6 space-y-3">
      <li v-for="order in items" :key="order.id" class="card flex flex-wrap items-center justify-between gap-4 p-4 sm:p-5">
        <div class="min-w-0">
          <p class="truncate font-bold">{{ order.eventTitle }}</p>
          <p class="mt-1 text-sm text-muted">{{ fdate(order.startsAt) }}</p>
          <p class="text-xs text-muted">Commande du {{ fdate(order.paidAt ?? order.createdAt, { dateStyle: 'medium' }) }}</p>
          <p class="mt-2 text-sm">
            <span class="font-semibold">{{ money(order.total, order.currency) }}</span>
            <span class="text-muted"> · {{ statusLabel[order.status] }}</span>
            <span v-if="order.status === 'paid'" class="text-muted"> · {{ order.ticketCount }} billet{{ order.ticketCount === 1 ? '' : 's' }}</span>
          </p>
        </div>
        <NuxtLink :to="`/orders/${order.id}`" class="btn btn-primary !min-h-[44px] shrink-0">
          {{ order.status === 'paid' ? 'Voir mes billets' : 'Voir la commande' }}
        </NuxtLink>
      </li>
    </ul>
    <UiEmpty v-else-if="!pending" class="mt-6" title="Aucun achat associé à ce compte" text="Les commandes apparaîtront ici si elles ont été passées avec cette adresse e-mail vérifiée. Après un achat sans compte, crée un compte avec la même adresse." />
    <p v-if="error && items.length" class="mt-4 text-sm text-red-300" role="alert">{{ error }}</p>
    <button v-if="hasMore" type="button" class="btn btn-ghost mt-5 w-full sm:w-auto" :disabled="busy" @click="loadMore">
      {{ busy ? 'Chargement…' : 'Afficher les achats précédents' }}
    </button>
    <NuxtLink to="/events" class="btn btn-ghost mt-6 w-full sm:w-auto">Découvrir les événements</NuxtLink>
  </section>
</template>
