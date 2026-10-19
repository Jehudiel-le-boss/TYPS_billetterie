<script setup lang="ts">
definePageMeta({ layout: 'auth' }); useSeoMeta({ title: 'Accepter un billet', robots: 'noindex' })
const route = useRoute(); const toast = useToast(); const busy = ref(false)
async function accept() { busy.value = true; try { const r = await api<any>('/api/transfers/accept', { method: 'POST', body: { token: String(route.query.token ?? '') } }); await navigateTo(`/orders/${r.orderId}?k=${r.k}`) } catch (e) { toast.err(errMsg(e)) } finally { busy.value = false } }
</script>
<template><h1 class="text-2xl font-black">Un billet t’est offert</h1><p class="mt-3 text-muted">En acceptant, le billet t’est attribué et l’ancien QR code est définitivement invalidé.</p><button class="btn btn-primary mt-6 w-full !min-h-[52px]" :disabled="busy" @click="accept">Accepter le billet</button></template>
