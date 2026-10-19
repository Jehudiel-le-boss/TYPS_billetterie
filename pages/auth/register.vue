<script setup lang="ts">
definePageMeta({ layout: 'auth' }); useSeoMeta({ title: 'Créer un compte', robots: 'noindex' })
const toast = useToast(); const f = reactive({ fullName: '', email: '', password: '' }); const busy = ref(false)
async function submit() {
  busy.value = true
  try {
    const auth = await useNeonAuth()
    const result = await auth.adapter.signUp.email({ name: f.fullName, email: f.email, password: f.password, callbackURL: `${window.location.origin}/auth/verify` })
    if (result.error) throw new Error(result.error.message || 'Création du compte impossible')
    if (!result.data?.user?.emailVerified) {
      toast.ok('Compte créé. Vérifie ton adresse e-mail avec le lien envoyé par Neon.')
      await navigateTo('/auth/login')
      return
    }
    await syncNeonSession()
    toast.ok('Compte créé. Bienvenue sur TYPS !')
    await navigateTo('/app')
  } catch (e) { toast.err(errMsg(e)) } finally { busy.value = false }
}
</script>
<template>
  <h1 class="text-2xl font-black">Créer mon compte</h1><p class="mt-1 text-sm text-muted">Gratuit. Tu pourras créer ton organisation juste après.</p>
  <form class="mt-6 space-y-4" @submit.prevent="submit"><label class="block"><span class="label">Nom complet</span><input v-model="f.fullName" required minlength="2" autocomplete="name" class="input"></label><label class="block"><span class="label">E-mail</span><input v-model="f.email" type="email" required autocomplete="email" class="input"></label><label class="block"><span class="label">Mot de passe</span><input v-model="f.password" type="password" required minlength="10" autocomplete="new-password" class="input"><span class="hint">10 caractères minimum.</span></label><button class="btn btn-primary w-full" :disabled="busy">{{ busy ? 'Création…' : 'Créer mon compte' }}</button></form>
  <p class="mt-5 text-sm text-muted">Déjà un compte TYPS ? Crée ton compte Neon avec la même adresse e-mail vérifiée pour retrouver tes organisations et tes billets. <NuxtLink to="/auth/login" class="text-accent underline">Déjà sur Neon ? Connecte-toi</NuxtLink></p>
</template>
