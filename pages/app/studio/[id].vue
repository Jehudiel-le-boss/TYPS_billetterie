<script setup lang="ts">
definePageMeta({ layout: 'dashboard', middleware: 'auth' }); useSeoMeta({ title: 'Éditeur de billet', robots: 'noindex' })
const id = String(useRoute().params.id)
</script>
<template><div class="-m-4 sm:-m-6 lg:-m-8"><ClientOnly><TicketEditor :template-id="id" /><template #fallback><div class="skeleton m-8 h-[60vh]" /></template></ClientOnly></div></template>
