<script setup lang="ts">
import { LoaderCircle } from '@lucide/vue'
definePageMeta({ layout: 'auth' }); useSeoMeta({ title: 'Vérification de l’e-mail', robots: 'noindex' })
const route = useRoute(); const state = ref<'wait' | 'ok' | 'pending' | 'ko'>('wait')
const failureMessage = ref('')
const nextPath = computed(() => {
  const next = String(route.query.next ?? '')
  return next.startsWith('/') && !next.startsWith('//') ? next : '/app'
})
async function signInGoogle() {
  state.value = 'wait'
  failureMessage.value = ''
  try {
    const auth = await useNeonAuth()
    const callbackURL = new URL('/auth/verify', window.location.origin)
    callbackURL.searchParams.set('next', nextPath.value)
    const result = await auth.adapter.signIn.social({ provider: 'google', callbackURL: callbackURL.toString() })
    if (result.error) throw new Error(result.error.message || 'Connexion Google impossible')
    if (!result.data?.url) throw new Error('Neon Auth n’a pas fourni le lien de connexion Google')
    window.location.assign(result.data.url)
  } catch (error) {
    failureMessage.value = errMsg(error)
    state.value = 'ko'
  }
}
onMounted(async () => {
  if (route.query.error) {
    const code = String(route.query.error)
    failureMessage.value = code === 'access_denied'
      ? 'La connexion Google a été annulée. Tu peux réessayer.'
      : 'Neon Auth a refusé ou interrompu le retour de connexion. Réessaie avec Google ou connecte-toi avec ton e-mail.'
    state.value = 'ko'
    return
  }
  try {
    const auth = await useNeonAuth()
    const result = await auth.adapter.getSession()
    if (result.error) throw new Error(result.error.message || 'Impossible de récupérer la session Neon')
    if (!result.data?.session) {
      state.value = 'pending'
      return
    }
    await syncNeonSession()
    state.value = 'ok'
  } catch (error) {
    failureMessage.value = errMsg(error)
    state.value = 'ko'
  }
})
</script>
<template>
  <h1 class="text-2xl font-black">{{ state === 'ok' ? 'Connexion réussie' : 'Finaliser la connexion' }}</h1>
  <p v-if="state === 'wait'" class="mt-4 flex items-center gap-2 text-muted"><LoaderCircle class="animate-spin" :size="18" />Vérification de la session Neon…</p>
  <p v-else-if="state === 'ok'" class="mt-4 text-emerald-300" role="status">Ton compte TYPS est prêt.</p>
  <p v-else-if="state === 'pending'" class="mt-4 text-muted" role="status">Aucune session Neon n’est active dans ce navigateur. Si tu viens de créer ton compte par e-mail, confirme le lien reçu puis connecte-toi. Pour Google, relance la connexion avec le même compte Google.</p>
  <p v-else class="mt-4 rounded-xl border border-red-400/30 bg-red-400/10 p-4 text-sm text-red-200" role="alert">{{ failureMessage || 'La session n’a pas pu être finalisée.' }}</p>
  <NuxtLink v-if="state === 'ok'" :to="nextPath" class="btn btn-primary mt-6 w-full">Continuer</NuxtLink>
  <div v-else-if="state !== 'wait'" class="mt-6 space-y-3">
    <button type="button" class="btn btn-primary w-full" @click="signInGoogle">Réessayer avec Google</button>
    <NuxtLink to="/auth/login" class="btn btn-ghost w-full">Se connecter avec e-mail</NuxtLink>
    <NuxtLink to="/auth/register" class="block text-center text-sm text-accent underline">Créer un compte</NuxtLink>
  </div>
</template>
