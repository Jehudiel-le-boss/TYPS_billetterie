<script setup lang="ts">
const route = useRoute(); const id = String(route.params.id); const k = String(route.query.k ?? '')
useHead({ meta: [{ name: 'robots', content: 'noindex' }] }); useSeoMeta({ title: 'Mes billets' })
const toast = useToast()
const { data: order, error, refresh } = await useAsyncData(`order-${id}`, () => api<any>(`/api/orders/${id}`, { query: { k } }), { server: false })
const tr = reactive<{ id: string | null; name: string; email: string; busy: boolean }>({ id: null, name: '', email: '', busy: false })
async function transfer() { tr.busy = true; try { await api(`/api/tickets/${tr.id}/transfer`, { method: 'POST', query: { k }, body: { toName: tr.name, toEmail: tr.email } }); toast.ok('Invitation envoyée : le transfert se fait quand le destinataire accepte.'); tr.id = null } catch (e) { toast.err(errMsg(e)) } finally { tr.busy = false } }
const dl = (path: string) => `${path}${path.includes('?') ? '&' : '?'}k=${k}`
void refresh
</script>
<template>
  <div class="container-x max-w-4xl py-10">
    <div v-if="error" class="py-16"><UiEmpty title="Commande introuvable" text="Le lien est incomplet ou n’est plus valide. Utilise le lien reçu par e-mail." /></div>
    <div v-else-if="!order" class="space-y-4"><div class="skeleton h-12 w-64" /><div class="skeleton h-48" /></div>
    <template v-else>
      <p class="text-sm font-semibold text-accent">{{ order.event?.title }} · {{ fdate(order.event?.startsAt) }}</p><h1 class="mt-2 text-[clamp(1.8rem,4vw,2.8rem)] font-black">Mes billets</h1>
      <p v-if="order.isDemo" class="mt-3 rounded-xl border border-amber-400/40 bg-amber-400/10 p-3 text-sm text-amber-200">Billets de démonstration : ils ne sont pas valables.</p>
      <div v-if="order.status !== 'paid'" class="mt-8"><UiEmpty title="Commande non payée" text="Les billets sont émis après confirmation du paiement."><NuxtLink :to="`/orders/${id}/confirmation?k=${k}`" class="btn btn-primary mt-2">Vérifier le paiement</NuxtLink></UiEmpty></div>
      <template v-else>
        <div class="mt-6 flex flex-wrap gap-2"><a class="btn btn-ghost" :href="dl(`/api/orders/${id}/tickets.pdf`)">Planche PDF (impression A4)</a><a class="btn btn-ghost" :href="dl(`/api/orders/${id}/tickets.zip`)">Tout en ZIP</a></div>
        <ul class="mt-8 space-y-8"><li v-for="t in order.tickets" :key="t.id" class="card p-4 sm:p-6"><div class="mb-4 flex flex-wrap items-center justify-between gap-3"><div><p class="font-display text-lg font-bold">{{ t.category }} <span v-if="t.vip" class="chip ml-2 text-accent">VIP</span></p><p class="text-sm text-muted">{{ t.holderName }} · {{ t.ref }}</p></div>
          <div class="flex flex-wrap gap-2"><a class="btn btn-primary !min-h-[44px]" :href="dl(`/api/tickets/${t.id}/pdf?dl=1`)">Télécharger le PDF</a><a class="btn btn-ghost !min-h-[44px]" :href="dl(`/api/tickets/${t.id}/qr.png?size=1200`)" download>QR HD</a><button v-if="order.event?.transfersEnabled && t.status === 'valid'" class="btn btn-ghost !min-h-[44px]" @click="tr.id = t.id">Transférer</button></div></div>
          <TicketView :id="t.id" :k="k" />
          <form v-if="tr.id === t.id" class="mt-4 grid gap-3 rounded-xl border border-line p-4 sm:grid-cols-2" @submit.prevent="transfer"><p class="font-bold sm:col-span-2">Transférer ce billet</p><label class="block"><span class="label">Nom du destinataire</span><input v-model="tr.name" required class="input"></label><label class="block"><span class="label">E-mail du destinataire</span><input v-model="tr.email" type="email" required class="input"></label><p class="hint sm:col-span-2">À l’acceptation, ton QR code est invalidé et un nouveau billet est émis au destinataire : jamais deux billets valides.</p><div class="flex gap-2 sm:col-span-2"><button class="btn btn-primary" :disabled="tr.busy">Envoyer l’invitation</button><button type="button" class="btn btn-ghost" @click="tr.id = null">Annuler</button></div></form></li></ul>
      </template>
    </template>
  </div>
</template>
