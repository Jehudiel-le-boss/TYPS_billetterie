<script setup lang="ts">
definePageMeta({ layout: 'auth' }); useSeoMeta({ title: 'Vérification de l’e-mail', robots: 'noindex' })
const route = useRoute(); const state = ref<'wait' | 'ok' | 'ko'>('wait')
onMounted(async () => { try { await api('/api/auth/verify', { method: 'POST', body: { token: String(route.query.token ?? '') } }); state.value = 'ok'; refreshMe() } catch { state.value = 'ko' } })
</script>
<template>
  <h1 class="text-2xl font-black">Vérification de l’e-mail</h1>
  <p v-if="state === 'wait'" class="mt-4 text-muted">Vérification en cours…</p><p v-else-if="state === 'ok'" class="mt-4 text-emerald-300" role="status">Adresse confirmée. Merci !</p><p v-else class="mt-4 text-red-300" role="alert">Lien invalide ou expiré.</p>
  <NuxtLink to="/app" class="btn btn-primary mt-6 w-full">Aller à mon espace</NuxtLink>
</template>
