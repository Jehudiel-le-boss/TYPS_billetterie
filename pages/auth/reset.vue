<script setup lang="ts">
definePageMeta({ layout: 'auth' }); useSeoMeta({ title: 'Nouveau mot de passe', robots: 'noindex' })
const route = useRoute(); const toast = useToast(); const password = ref(''); const busy = ref(false)
async function submit() { busy.value = true; try { const token = String(route.query.token ?? ''); if (!token) throw new Error('Lien de réinitialisation manquant ou expiré'); const auth = await useNeonAuth(); const result = await auth.adapter.resetPassword({ token, newPassword: password.value }); if (result.error) throw new Error(result.error.message || 'Réinitialisation impossible'); toast.ok('Mot de passe modifié. Connecte-toi.'); await navigateTo('/auth/login') } catch (e) { toast.err(errMsg(e)) } finally { busy.value = false } }
</script>
<template>
  <h1 class="text-2xl font-black">Nouveau mot de passe</h1>
  <form class="mt-6 space-y-4" @submit.prevent="submit"><label class="block"><span class="label">Nouveau mot de passe</span><input v-model="password" type="password" required minlength="10" autocomplete="new-password" class="input"></label><button class="btn btn-primary w-full" :disabled="busy">Enregistrer</button></form>
</template>
