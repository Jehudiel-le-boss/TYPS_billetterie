<script setup lang="ts">
definePageMeta({ layout: 'auth' }); useSeoMeta({ title: 'Vérification de l’e-mail', robots: 'noindex' })
const route = useRoute(); const state = ref<'wait' | 'ok' | 'pending' | 'ko'>('wait')
onMounted(async () => {
  if (route.query.error) { state.value = 'ko'; return }
  try {
    const auth = await useNeonAuth()
    const result = await auth.adapter.getSession()
    if (result.error) throw new Error(result.error.message || 'Vérification impossible')
    if (!result.data || !('user' in result.data) || !result.data.user.emailVerified) { state.value = 'pending'; return }
    await syncNeonSession()
    state.value = 'ok'
  } catch { state.value = 'ko' }
})
</script>
<template>
  <h1 class="text-2xl font-black">Vérification de l’e-mail</h1>
  <p v-if="state === 'wait'" class="mt-4 text-muted">Vérification en cours…</p><p v-else-if="state === 'ok'" class="mt-4 text-emerald-300" role="status">Adresse confirmée. Ton compte TYPS est prêt.</p><p v-else-if="state === 'pending'" class="mt-4 text-muted" role="status">Si tu viens de confirmer ton adresse, connecte-toi pour ouvrir ton espace. Sinon, utilise le lien reçu par e-mail.</p><p v-else class="mt-4 text-red-300" role="alert">Le lien de vérification a expiré ou n’est plus valide. Connecte-toi ou demande un nouveau lien.</p>
  <NuxtLink v-if="state === 'ok'" to="/app" class="btn btn-primary mt-6 w-full">Aller à mon espace</NuxtLink><NuxtLink v-else to="/auth/login" class="btn btn-primary mt-6 w-full">Se connecter</NuxtLink>
</template>
