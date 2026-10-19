<script setup lang="ts">
definePageMeta({ layout: 'dashboard', middleware: 'admin' }); useSeoMeta({ title: 'Administration', robots: 'noindex' })
const { data: o } = await useAsyncData('adm-over', () => api<any>('/api/admin/overview'), { server: false })
const cards = computed(() => o.value ? [['Utilisateurs', o.value.users], ['Organisations', o.value.organizations], ['Événements', o.value.events], ['Publiés', o.value.published], ['Billets valides/utilisés', o.value.tickets], ['Volume payé (hors démo)', money(Number(o.value.gmv))], ['Commissions TYPS', money(Number(o.value.platform_fees))], ['Remboursements à traiter', o.value.refunds_open], ['Signalements ouverts', o.value.reports_open], ['Webhooks non traités', o.value.webhooks_pending]] : [])
</script>
<template><div class="space-y-6"><h1 class="text-[clamp(1.8rem,4vw,2.6rem)] font-black">Administration TYPS</h1><div v-if="!o" class="skeleton h-40" /><div v-else class="grid gap-4 sm:grid-cols-2 lg:grid-cols-5"><div v-for="c in cards" :key="c[0]" class="card p-5"><p class="text-sm text-muted">{{ c[0] }}</p><p class="mt-1 font-display text-2xl font-black">{{ c[1] }}</p></div></div></div></template>
