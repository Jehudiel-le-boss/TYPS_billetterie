<script setup lang="ts">
definePageMeta({ layout: 'auth' }); useSeoMeta({ title: 'Connexion', robots: 'noindex' })
const route = useRoute(); const toast = useToast(); const f = reactive({ email: '', password: '' }); const busy = ref(false)
async function submit() { busy.value = true; try { await api('/api/auth/login', { method: 'POST', body: f }); await refreshMe(); const next = String(route.query.next ?? ''); await navigateTo(next.startsWith('/') && !next.startsWith('//') ? next : '/app') } catch (e) { toast.err(errMsg(e)) } finally { busy.value = false } }
</script>
<template>
  <h1 class="text-2xl font-black">Connexion</h1><p class="mt-1 text-sm text-muted">Retrouve tes événements et tes billets.</p>
  <form class="mt-6 space-y-4" @submit.prevent="submit"><label class="block"><span class="label">E-mail</span><input v-model="f.email" type="email" required autocomplete="email" class="input"></label><label class="block"><span class="label">Mot de passe</span><input v-model="f.password" type="password" required autocomplete="current-password" class="input"></label><button class="btn btn-primary w-full" :disabled="busy">{{ busy ? 'Connexion…' : 'Se connecter' }}</button></form>
  <div class="mt-5 flex justify-between text-sm"><NuxtLink to="/auth/forgot" class="text-accent underline">Mot de passe oublié ?</NuxtLink><NuxtLink to="/auth/register" class="text-accent underline">Créer un compte</NuxtLink></div>
</template>
