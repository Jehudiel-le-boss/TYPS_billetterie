<script setup lang="ts">
const toast = useToast(); const name = ref(''); const busy = ref(false)
async function create() { busy.value = true; try { const o = await api<any>('/api/orgs', { method: 'POST', body: { name: name.value } }); await refreshMe(); useOrg().select(o.id); toast.ok('Organisation créée') } catch (e) { toast.err(errMsg(e)) } finally { busy.value = false } }
</script>
<template>
  <div class="mx-auto max-w-lg py-10"><div class="card space-y-4 p-8" data-guide="organizer-create-org"><h1 class="text-2xl font-black">Crée ton organisation</h1><p class="text-muted">C’est le nom sous lequel tes événements et tes billets apparaissent. Tu pourras inviter ton équipe ensuite.</p><form class="space-y-4" @submit.prevent="create"><label class="block"><span class="label">Nom de l’organisation</span><input v-model="name" required minlength="2" class="input" placeholder="ex. Collectif Lagune"></label><button class="btn btn-primary w-full" :disabled="busy">Créer et continuer</button></form></div></div>
</template>
