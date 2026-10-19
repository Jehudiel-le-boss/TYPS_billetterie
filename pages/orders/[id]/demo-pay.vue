<script setup lang="ts">
const route = useRoute(); const id = String(route.params.id); const k = String(route.query.k ?? ''); const toast = useToast(); const busy = ref(false)
useHead({ meta: [{ name: 'robots', content: 'noindex' }] }); useSeoMeta({ title: 'Paiement de démonstration' })
async function go() { busy.value = true; try { await api(`/api/orders/${id}/demo-pay`, { method: 'POST', query: { k } }); await navigateTo(`/orders/${id}/confirmation?k=${k}`) } catch (e) { toast.err(errMsg(e)) } finally { busy.value = false } }
</script>
<template>
  <div class="container-x grid min-h-[70vh] place-items-center py-12"><div class="card w-full max-w-lg space-y-5 p-8 text-center"><span class="chip mx-auto !border-amber-400/50 text-amber-300">Mode démonstration</span><h1 class="text-3xl font-black">Paiement simulé</h1><p class="text-muted">Cet événement est une démonstration : aucun argent n’est débité et FedaPay n’est pas utilisé. Les billets émis sont marqués « DÉMO ».</p><button class="btn btn-primary w-full !min-h-[52px]" :disabled="busy" @click="go">Simuler un paiement réussi</button></div></div>
</template>
