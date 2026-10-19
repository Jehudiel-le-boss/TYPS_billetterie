<script setup lang="ts">
const route = useRoute(); const id = String(route.params.id); const k = String(route.query.k ?? '')
useHead({ meta: [{ name: 'robots', content: 'noindex' }] }); useSeoMeta({ title: 'Confirmation de commande' })
// On ne se fie JAMAIS à l'URL de retour : le serveur vérifie le paiement auprès de FedaPay à chaque lecture.
const order = ref<any>(null); const err = ref(''); let tries = 0, timer: ReturnType<typeof setTimeout>
async function load() { try { order.value = await api(`/api/orders/${id}`, { query: { k } }); err.value = '' } catch (e) { err.value = errMsg(e) } if (order.value?.status === 'pending' && ++tries < 40) timer = setTimeout(load, 3000) }
onMounted(load); onBeforeUnmount(() => clearTimeout(timer))
const state = computed(() => order.value?.status === 'paid' ? 'ok' : ['failed', 'expired', 'cancelled'].includes(order.value?.status) || ['failed'].includes(order.value?.verification) ? 'ko' : 'wait')
</script>
<template>
  <div class="container-x grid min-h-[70vh] place-items-center py-12"><div class="card w-full max-w-lg p-8 text-center" aria-live="polite">
    <p v-if="err" class="text-red-300">{{ err }}</p>
    <div v-else-if="!order" class="space-y-3"><div class="skeleton mx-auto h-16 w-16 !rounded-full" /><div class="skeleton mx-auto h-6 w-48" /></div>
    <template v-else-if="state === 'ok'"><div class="mx-auto grid h-16 w-16 place-items-center rounded-full bg-emerald-500/20 text-3xl text-emerald-300" aria-hidden="true">✓</div><h1 class="mt-5 text-3xl font-black">Paiement confirmé</h1><p class="mt-2 text-muted">{{ order.tickets.length }} billet{{ order.tickets.length > 1 ? 's' : '' }} pour <strong class="text-fg">{{ order.event?.title }}</strong>. Un e-mail est envoyé à {{ order.buyerEmail }} si le service d’envoi est configuré.</p><NuxtLink :to="`/orders/${id}?k=${k}`" class="btn btn-primary mt-8 w-full !min-h-[52px]">Voir et télécharger mes billets</NuxtLink><p class="hint">Conserve ce lien : c’est ton accès à tes billets.</p></template>
    <template v-else-if="state === 'ko'"><div class="mx-auto grid h-16 w-16 place-items-center rounded-full bg-red-500/20 text-3xl text-red-300" aria-hidden="true">✕</div><h1 class="mt-5 text-3xl font-black">Paiement non abouti</h1><p class="mt-2 text-muted">Aucun billet n’a été émis et aucun montant ne t’est dû pour cette commande. Les places réservées sont libérées.</p><NuxtLink v-if="order.event" :to="`/events/${order.event.slug}/achat`" class="btn btn-primary mt-8 w-full">Réessayer</NuxtLink></template>
    <template v-else><div class="mx-auto h-14 w-14 animate-spin rounded-full border-4 border-line border-t-accent" aria-hidden="true" /><h1 class="mt-5 text-2xl font-black">Vérification du paiement…</h1><p class="mt-2 text-muted">Nous interrogeons directement FedaPay pour confirmer ta transaction. Cela prend quelques secondes ; tu peux rester sur cette page.</p></template>
  </div></div>
</template>
