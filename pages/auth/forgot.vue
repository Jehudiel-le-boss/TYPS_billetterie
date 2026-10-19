<script setup lang="ts">
definePageMeta({ layout: 'auth' }); useSeoMeta({ title: 'Mot de passe oublié', robots: 'noindex' })
const toast = useToast(); const email = ref(''); const sent = ref(false); const busy = ref(false)
async function submit() { busy.value = true; try { await api('/api/auth/forgot', { method: 'POST', body: { email: email.value } }); sent.value = true } catch (e) { toast.err(errMsg(e)) } finally { busy.value = false } }
</script>
<template>
  <h1 class="text-2xl font-black">Mot de passe oublié</h1>
  <p v-if="sent" class="mt-4 rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-4 text-sm" role="status">Si un compte existe pour cette adresse, un lien de réinitialisation vient d’être envoyé (valable 1 heure).</p>
  <form v-else class="mt-6 space-y-4" @submit.prevent="submit"><label class="block"><span class="label">E-mail du compte</span><input v-model="email" type="email" required class="input"></label><button class="btn btn-primary w-full" :disabled="busy">Envoyer le lien</button></form>
  <NuxtLink to="/auth/login" class="mt-5 block text-sm text-accent underline">Retour à la connexion</NuxtLink>
</template>
