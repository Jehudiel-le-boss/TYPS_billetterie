<script setup lang="ts">
definePageMeta({ layout: 'auth' }); useSeoMeta({ title: 'Créer un compte', robots: 'noindex' })
const toast = useToast(); const f = reactive({ fullName: '', email: '', phone: '', password: '' }); const busy = ref(false)
async function submit() { busy.value = true; try { await api('/api/auth/register', { method: 'POST', body: { ...f, phone: f.phone || undefined } }); await refreshMe(); toast.ok('Compte créé. Vérifie ta boîte e-mail pour confirmer ton adresse.'); await navigateTo('/app') } catch (e) { toast.err(errMsg(e)) } finally { busy.value = false } }
</script>
<template>
  <h1 class="text-2xl font-black">Créer mon compte</h1><p class="mt-1 text-sm text-muted">Gratuit. Tu pourras créer ton organisation juste après.</p>
  <form class="mt-6 space-y-4" @submit.prevent="submit"><label class="block"><span class="label">Nom complet</span><input v-model="f.fullName" required minlength="2" autocomplete="name" class="input"></label><label class="block"><span class="label">E-mail</span><input v-model="f.email" type="email" required autocomplete="email" class="input"></label><label class="block"><span class="label">Téléphone (facultatif)</span><input v-model="f.phone" type="tel" autocomplete="tel" class="input"></label><label class="block"><span class="label">Mot de passe</span><input v-model="f.password" type="password" required minlength="10" autocomplete="new-password" class="input"><span class="hint">10 caractères minimum.</span></label><button class="btn btn-primary w-full" :disabled="busy">{{ busy ? 'Création…' : 'Créer mon compte' }}</button></form>
  <p class="mt-5 text-sm text-muted">Déjà inscrit ? <NuxtLink to="/auth/login" class="text-accent underline">Connexion</NuxtLink></p>
</template>
