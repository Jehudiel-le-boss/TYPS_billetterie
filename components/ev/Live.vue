<script setup lang="ts">
// Mode événement en direct : rafraîchi toutes les 5 s, uniquement des données réelles.
const props = defineProps<{ ev: any }>(); const d = ref<any>(null); let t: ReturnType<typeof setInterval>
const load = async () => { try { d.value = await api(`/api/scan/${props.ev.id}/history`) } catch { /* garde l'état précédent */ } }
onMounted(() => { load(); t = setInterval(load, 5000) }); onBeforeUnmount(() => clearInterval(t))
const recent = computed(() => (d.value?.items ?? []).filter((i: any) => Date.now() - new Date(i.at).getTime() < 15 * 60_000))
const gates = computed(() => [...new Set(recent.value.map((i: any) => i.gate))]); const agents = computed(() => [...new Set(recent.value.map((i: any) => i.agent).filter(Boolean))])
const alerts = computed(() => recent.value.filter((i: any) => i.result !== 'accepted'))
const col: Record<string, string> = { accepted: 'bg-emerald-600', already_used: 'bg-orange-600' }
const txt: Record<string, string> = { accepted: 'Accepté', already_used: 'Déjà utilisé', invalid: 'Invalide', cancelled: 'Annulé', refunded: 'Remboursé', suspended: 'Suspendu', wrong_event: 'Autre événement', not_started: 'Hors période' }
</script>
<template>
  <div v-if="!d" class="skeleton h-64" />
  <div v-else class="space-y-6">
    <div class="grid gap-4 sm:grid-cols-4"><div class="card p-5 sm:col-span-2"><p class="text-sm text-muted">Entrées</p><p class="font-display text-6xl font-black">{{ d.entries }}<span class="text-2xl text-muted"> / {{ d.capacity }}</span></p><div class="mt-3 h-2 overflow-hidden rounded-full bg-line"><div class="h-full bg-gradient-to-r from-accent to-accent2 transition-all" :style="{ width: Math.min(100, (d.entries / d.capacity) * 100) + '%' }" /></div></div><div class="card p-5"><p class="text-sm text-muted">Portes actives (15 min)</p><p class="font-display text-4xl font-black">{{ gates.length }}</p><p class="text-xs text-muted">{{ gates.join(', ') || '—' }}</p></div><div class="card p-5"><p class="text-sm text-muted">Agents connectés</p><p class="font-display text-4xl font-black">{{ agents.length }}</p><p class="text-xs text-muted">{{ agents.join(', ') || '—' }}</p></div></div>
    <div v-if="alerts.length" class="rounded-tk border border-orange-500/50 bg-orange-500/10 p-4"><p class="font-bold text-orange-200">{{ alerts.length }} alerte(s) sur les 15 dernières minutes</p><p class="text-sm text-orange-100/80">Doublons, billets invalides ou annulés présentés à l’entrée.</p></div>
    <div class="card overflow-hidden"><h2 class="p-4 text-lg font-bold">Dernières validations</h2><ul v-if="d.items.length" class="divide-y divide-line"><li v-for="i in d.items.slice(0, 25)" :key="i.id" class="flex items-center gap-3 px-4 py-3 text-sm"><span class="rounded-full px-2.5 py-1 text-xs font-bold text-white" :class="col[i.result] ?? 'bg-red-700'">{{ txt[i.result] }}</span><span class="font-mono">{{ i.ref ?? '—' }}</span><span class="text-muted">{{ i.category }}</span><span class="ml-auto text-muted">{{ i.gate }} · {{ fdate(i.at, { timeStyle: 'medium' }) }}{{ i.source === 'offline' ? ' · hors ligne' : '' }}</span></li></ul><UiEmpty v-else title="Aucun scan pour l’instant" text="Les entrées s’affichent ici en temps réel." /></div>
  </div>
</template>
