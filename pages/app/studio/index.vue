<script setup lang="ts">
definePageMeta({ layout: 'dashboard', middleware: 'auth' }); useSeoMeta({ title: 'Studio de billets', robots: 'noindex' })
const { current } = useOrg(); const toast = useToast(); const name = ref(''); const deleting = ref<string | null>(null)
const { data, refresh, pending } = await useAsyncData('tpls', () => (current.value ? api<any[]>('/api/templates', { query: { orgId: current.value.id } }) : Promise.resolve([])), { watch: [() => current.value?.id], server: false })
async function create() { try { const r = await api<{ id: string }>('/api/templates', { method: 'POST', body: { organizationId: current.value!.id, name: name.value || 'Nouveau modèle' } }); await navigateTo(`/app/studio/${r.id}`) } catch (e) { toast.err(errMsg(e)) } }
async function dup(id: string) { try { await api(`/api/templates/${id}/duplicate`, { method: 'POST' }); toast.ok('Modèle dupliqué'); refresh() } catch (e) { toast.err(errMsg(e)) } }
async function remove(t: { id: string; name: string }) {
  if (!confirm(`Archiver « ${t.name} » ? Le modèle ne sera plus modifiable ni sélectionnable, mais les billets déjà associés conserveront leur rendu.`)) return
  deleting.value = t.id
  try { await api(`/api/templates/${t.id}`, { method: 'DELETE' }); toast.ok('Modèle archivé'); await refresh() } catch (e) { toast.err(errMsg(e)) } finally { deleting.value = null }
}
</script>
<template>
  <OrgOnboarding v-if="!current" />
  <div v-else class="space-y-6"><div><h1 class="text-[clamp(1.8rem,4vw,2.6rem)] font-black">Studio de billets</h1><p class="mt-2 max-w-2xl text-muted">Tes modèles sauvegardés, duplicables et réutilisables. Importe ton visuel (PNG, JPG, PDF) et place les champs dynamiques où tu veux.</p></div>
    <form class="card flex flex-wrap items-end gap-3 p-5" @submit.prevent="create"><label class="block min-w-[220px] flex-1"><span class="label">Nom du nouveau modèle</span><input v-model="name" class="input" placeholder="ex. Billet Festival 2026"></label><button class="btn btn-primary">Créer un modèle</button></form>
    <div v-if="pending" class="skeleton h-40" /><UiEmpty v-else-if="!data?.length" title="Aucun modèle" text="Crée ton premier modèle pour personnaliser tes billets." />
    <div v-else class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"><article v-for="t in data" :key="t.id" class="card space-y-3 p-5"><div class="flex items-start justify-between gap-2"><h2 class="font-display text-lg font-bold">{{ t.name }}</h2><span class="chip" :class="t.published ? 'text-emerald-300' : 'text-amber-300'">{{ t.published ? 'Publié' : 'Brouillon' }}</span></div><p class="text-xs text-muted">Modifié le {{ fdate(t.updatedAt, { dateStyle: 'medium', timeStyle: 'short' }) }}</p><div class="flex flex-wrap gap-2"><NuxtLink :to="`/app/studio/${t.id}`" class="btn btn-primary min-w-0 flex-1 !min-h-[40px]">Ouvrir l’éditeur</NuxtLink><button class="btn btn-ghost !min-h-[40px]" @click="dup(t.id)">Dupliquer</button><button class="btn btn-danger !min-h-[40px]" :disabled="deleting !== null" @click="remove(t)">{{ deleting === t.id ? 'Archivage…' : 'Supprimer' }}</button></div></article></div></div>
</template>
