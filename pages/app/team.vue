<script setup lang="ts">
definePageMeta({ layout: 'dashboard', middleware: 'auth' }); useSeoMeta({ title: 'Équipe', robots: 'noindex' })
const { current } = useOrg(); const toast = useToast(); const f = reactive({ email: '', role: 'seller' })
const { data, refresh } = await useAsyncData('members', () => (current.value ? api<any[]>(`/api/orgs/${current.value.id}/members`).catch(() => []) : Promise.resolve([])), { watch: [() => current.value?.id], server: false })
const roles: Record<string, string> = { owner: 'Propriétaire', manager: 'Gestionnaire', seller: 'Vendeur guichet', agent: 'Agent de contrôle', viewer: 'Lecture seule' }
async function add() { try { await api(`/api/orgs/${current.value!.id}/members`, { method: 'POST', body: f }); toast.ok('Membre ajouté'); f.email = ''; refresh() } catch (e) { toast.err(errMsg(e)) } }
async function remove(m: any) { if (!confirm(`Retirer ${m.name || m.email} ?`)) return; try { await api(`/api/orgs/${current.value!.id}/members/${m.id}`, { method: 'DELETE' }); refresh() } catch (e) { toast.err(errMsg(e)) } }
</script>
<template>
  <OrgOnboarding v-if="!current" />
  <div v-else class="space-y-6"><h1 class="text-[clamp(1.8rem,4vw,2.6rem)] font-black">Équipe</h1>
    <div class="grid gap-6 xl:grid-cols-[380px_1fr]"><form class="card space-y-3 p-5" @submit.prevent="add"><h2 class="text-lg font-bold">Ajouter un membre</h2><label class="block"><span class="label">E-mail du compte TYPS</span><input v-model="f.email" type="email" required class="input"></label><label class="block"><span class="label">Rôle</span><select v-model="f.role" class="input"><option value="manager">Gestionnaire</option><option value="seller">Vendeur guichet</option><option value="agent">Agent de contrôle</option><option value="viewer">Lecture seule</option></select></label><button class="btn btn-primary w-full">Ajouter</button><p class="hint">Pour limiter un agent à UN événement, utilise plutôt l’onglet Équipe de l’événement.</p></form>
      <div class="card overflow-x-auto"><table class="w-full min-w-[420px]"><thead><tr><th class="th">Membre</th><th class="th">Rôle</th><th class="th" /></tr></thead><tbody class="divide-y divide-line"><tr v-for="m in data" :key="m.id"><td class="td">{{ m.name }}<span class="block text-xs text-muted">{{ m.email }}</span></td><td class="td">{{ roles[m.role] }}</td><td class="td text-right"><button v-if="m.role !== 'owner'" class="btn btn-danger !min-h-[36px] px-3" @click="remove(m)">Retirer</button></td></tr></tbody></table></div></div></div>
</template>
