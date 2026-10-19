<script setup lang="ts">
import { themeById } from '~~/shared/themes'
const route = useRoute(); const slug = String(route.params.slug); const k = route.query.k ? String(route.query.k) : undefined
useHead({ meta: [{ name: 'robots', content: 'noindex' }] }); useSeoMeta({ title: 'Acheter mes billets' })
const { data: ev, error } = await useAsyncData(`buy-${slug}`, () => api<any>(`/api/events/${slug}`, { query: { k } }))
if (error.value) throw createError({ statusCode: 404, statusMessage: 'Événement introuvable', fatal: true })
const vars = computed(() => toStyle(cssVars(themeById(ev.value?.themeId))))
const me = useMe(); const toast = useToast()
const qty = reactive<Record<string, number>>({}); const buyer = reactive({ name: me.value.user?.fullName ?? '', email: me.value.user?.email ?? '', phone: '' }); const promo = ref(''); const accessCode = ref(''); const terms = ref(false); const busy = ref(false)
const items = computed(() => Object.entries(qty).filter(([, n]) => n > 0).map(([categoryId, quantity]) => ({ categoryId, quantity })))
const count = computed(() => items.value.reduce((s, i) => s + i.quantity, 0))
const quote = ref<any>(null); const quoteErr = ref('')
let qt: ReturnType<typeof setTimeout>
async function refreshQuote() { if (!items.value.length) { quote.value = null; return } try { quote.value = await api('/api/checkout/quote', { method: 'POST', body: { eventId: ev.value.id, items: items.value, promoCode: promo.value || undefined } }); quoteErr.value = '' } catch (e) { quoteErr.value = errMsg(e); if (!promo.value) quote.value = null } }
watch([items, promo], () => { clearTimeout(qt); qt = setTimeout(refreshQuote, 250) }, { deep: true })
const step = (c: any, d: number) => { const max = Math.min(c.available, c.maxPerOrder ?? ev.value.maxPerOrder); qty[c.id] = Math.max(0, Math.min(max, (qty[c.id] ?? 0) + d)) }
async function pay() {
  if (!terms.value) return toast.err('Accepte les conditions de vente pour continuer')
  busy.value = true
  try {
    const r = await api<any>('/api/checkout', { method: 'POST', body: { eventId: ev.value.id, items: items.value, buyer: { name: buyer.name, email: buyer.email, phone: buyer.phone || undefined }, promoCode: promo.value || undefined, accessCode: accessCode.value || undefined, acceptTerms: true, campaign: route.query.ref ? String(route.query.ref) : undefined } })
    if (r.external) window.location.href = r.redirect; else await navigateTo(r.redirect)
  } catch (e) { toast.err(errMsg(e)); refreshQuote() } finally { busy.value = false }
}
</script>
<template>
  <div v-if="ev" :style="vars" class="min-h-screen bg-bg text-fg"><div class="container-x py-10">
    <NuxtLink :to="`/events/${slug}${k ? `?k=${k}` : ''}`" class="text-sm text-muted hover:text-fg">← {{ ev.title }}</NuxtLink>
    <h1 class="mt-3 text-[clamp(1.8rem,4vw,2.8rem)] font-black">Mes billets</h1>
    <div class="mt-8 grid gap-8 lg:grid-cols-[1.3fr_1fr]">
      <form class="space-y-8" @submit.prevent="pay">
        <section aria-labelledby="h-cat"><h2 id="h-cat" class="text-xl font-bold">1. Catégorie et quantité</h2>
          <ul class="mt-4 space-y-3"><li v-for="c in ev.categories" :key="c.id" class="card flex flex-wrap items-center justify-between gap-3 p-4" :class="{ 'opacity-60': c.soldOut || !c.onSale }"><div><p class="font-bold">{{ c.name }}</p><p class="text-sm text-muted">{{ c.price === 0 ? 'Gratuit' : money(c.price, ev.currency) }} · {{ c.soldOut ? 'Épuisé' : !c.onSale ? 'Non ouvert' : `${c.available} dispo.` }}</p></div>
            <div class="flex items-center gap-3" role="group" :aria-label="`Quantité ${c.name}`"><button type="button" class="btn btn-ghost !h-11 !w-11 !p-0 text-xl" :disabled="!qty[c.id]" aria-label="Moins" @click="step(c, -1)">−</button><output class="w-8 text-center text-lg font-bold tabular-nums" aria-live="polite">{{ qty[c.id] ?? 0 }}</output><button type="button" class="btn btn-ghost !h-11 !w-11 !p-0 text-xl" :disabled="c.soldOut || !c.onSale" aria-label="Plus" @click="step(c, 1)">+</button></div></li></ul></section>
        <section aria-labelledby="h-info"><h2 id="h-info" class="text-xl font-bold">2. Tes informations</h2>
          <div class="mt-4 grid gap-4 sm:grid-cols-2"><label class="block"><span class="label">Nom complet</span><input v-model="buyer.name" required minlength="2" autocomplete="name" class="input"></label><label class="block"><span class="label">E-mail (réception des billets)</span><input v-model="buyer.email" type="email" required autocomplete="email" class="input"></label><label class="block"><span class="label">Téléphone (facultatif)</span><input v-model="buyer.phone" type="tel" autocomplete="tel" class="input"></label>
            <label v-if="ev.requiresAccessCode" class="block"><span class="label">Code d’accès</span><input v-model="accessCode" required class="input"></label></div></section>
        <section aria-labelledby="h-promo"><h2 id="h-promo" class="text-xl font-bold">3. Code promo</h2><div class="mt-4 max-w-sm"><label class="sr-only" for="promo">Code promo</label><input id="promo" v-model="promo" class="input uppercase" placeholder="CODE PROMO"><p v-if="quote?.promo" class="hint text-emerald-400">Code « {{ quote.promo }} » appliqué</p><p v-else-if="quoteErr && promo" class="hint text-red-300" role="alert">{{ quoteErr }}</p></div></section>
        <label class="flex items-start gap-3 text-sm"><input v-model="terms" type="checkbox" class="mt-1 h-5 w-5 accent-[rgb(var(--c-a))]" required><span>J’accepte les <NuxtLink to="/legal/conditions" target="_blank" class="text-accent underline">conditions de vente</NuxtLink> et la <NuxtLink to="/legal/remboursement" target="_blank" class="text-accent underline">politique de remboursement</NuxtLink>.</span></label>
        <button class="btn btn-primary w-full !min-h-[56px] text-lg lg:hidden" :disabled="busy || !count">{{ busy ? 'Redirection…' : quote ? `Payer ${money(quote.total, ev.currency)}` : 'Choisis tes billets' }}</button>
      </form>
      <aside class="lg:sticky lg:top-24 lg:self-start"><div class="card space-y-4 p-5"><h2 class="text-xl font-bold">Récapitulatif</h2>
        <UiEmpty v-if="!quote" title="Aucun billet choisi" text="Sélectionne une catégorie pour voir le total." />
        <dl v-else class="space-y-2 text-sm"><div class="flex justify-between"><dt class="text-muted">Sous-total</dt><dd class="font-semibold">{{ money(quote.subtotal, ev.currency) }}</dd></div><div v-if="quote.discount" class="flex justify-between text-emerald-400"><dt>Réduction</dt><dd>− {{ money(quote.discount, ev.currency) }}</dd></div><div v-if="quote.buyerFees" class="flex justify-between"><dt class="text-muted">Frais de service</dt><dd class="font-semibold">{{ money(quote.buyerFees, ev.currency) }}</dd></div><div class="perf my-3" /><div class="flex items-baseline justify-between text-lg"><dt class="font-bold">Total</dt><dd class="font-display text-2xl font-black">{{ quote.total === 0 ? 'Gratuit' : money(quote.total, ev.currency) }}</dd></div></dl>
        <button class="btn btn-primary hidden w-full !min-h-[56px] text-lg lg:inline-flex" :disabled="busy || !count || !terms" @click="pay">{{ busy ? 'Redirection…' : quote?.total === 0 ? 'Obtenir mes billets' : 'Payer avec FedaPay' }}</button>
        <p class="text-xs text-muted">Tu seras redirigé vers la page de paiement officielle. Tes billets ne sont émis qu’après confirmation du paiement par nos serveurs.</p></div></aside>
    </div></div></div>
</template>
