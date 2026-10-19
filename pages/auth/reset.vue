<script setup lang="ts">
definePageMeta({ layout: 'auth' }); useSeoMeta({ title: 'Nouveau mot de passe', robots: 'noindex' })
const route = useRoute(); const toast = useToast(); const password = ref(''); const busy = ref(false)
async function submit() { busy.value = true; try { await api('/api/auth/reset', { method: 'POST', body: { token: String(route.query.token ?? ''), password: password.value } }); toast.ok('Mot de passe modifié. Connecte-toi.'); await navigateTo('/auth/login') } catch (e) { toast.err(errMsg(e)) } finally { busy.value = false } }
</script>
<template>
  <h1 class="text-2xl font-black">Nouveau mot de passe</h1>
  <form class="mt-6 space-y-4" @submit.prevent="submit"><label class="block"><span class="label">Nouveau mot de passe</span><input v-model="password" type="password" required minlength="10" autocomplete="new-password" class="input"></label><button class="btn btn-primary w-full" :disabled="busy">Enregistrer</button></form>
</template>
