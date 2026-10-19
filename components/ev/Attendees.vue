<script setup lang="ts">
const props = defineProps<{ ev: any }>(); const toast = useToast()
const { data, refresh } = await useAsyncData(`att-${props.ev.id}`, () => api<any[]>(`/api/manage/events/${props.ev.id}/attendees`), { server: false })
const q = ref(''); const rows = computed(() => (data.value ?? []).filter((r) => !q.value || `${r.holder} ${r.ref} ${r.email ?? ''}`.toLowerCase().includes(q.value.toLowerCase())))
const cls = (s: string) => ({ valid: 'text-emerald-300', used: 'text-sky-300', cancelled: 'text-red-300', refunded: 'text-red-300', suspended: 'text-amber-300' }[s] ?? '')
async function setStatus(t: any, status: string) { if (!confirm(`Passer le billet ${t.ref} en « ${status} » ? Son QR ne sera plus accepté.`)) return; try { await api(`/api/manage/tickets/${t.id}/status`, { method: 'POST', body: { status } }); toast.ok('Billet mis à jour'); refresh() } catch (e) { toast.err(errMsg(e)) } }
</script>
<template>
  <div class="space-y-4"><div class="flex flex-wrap items-center gap-3"><input v-model="q" type="search" class="input max-w-xs" placeholder="Rechercher nom, référence…" aria-label="Rechercher"><span class="text-sm text-muted">{{ rows.length }} billet(s)</span><a class="btn btn-ghost ml-auto" :href="`/api/manage/events/${ev.id}/attendees?format=csv`">Exporter les participants (CSV)</a></div>
    <UiEmpty v-if="!rows.length" title="Aucun participant" text="Les billets émis apparaissent ici." />
    <div v-else class="card overflow-x-auto"><table class="w-full min-w-[760px]"><thead><tr><th class="th">Référence</th><th class="th">Participant</th><th class="th">Catégorie</th><th class="th">Canal</th><th class="th">Statut</th><th class="th" /></tr></thead>
      <tbody class="divide-y divide-line"><tr v-for="r in rows" :key="r.id"><td class="td font-mono text-xs">{{ r.ref }}</td><td class="td">{{ r.holder }}<span class="block text-xs text-muted">{{ r.email }}</span></td><td class="td">{{ r.category }}</td><td class="td text-muted capitalize">{{ r.source }}</td><td class="td font-semibold capitalize" :class="cls(r.status)">{{ r.status }}<span v-if="r.usedAt" class="block text-xs font-normal text-muted">{{ fdate(r.usedAt, { timeStyle: 'short', dateStyle: 'short' }) }}</span></td><td class="td text-right"><a class="btn btn-ghost !min-h-[36px] px-3" :href="`/api/tickets/${r.id}/pdf`" target="_blank" rel="noopener">PDF</a> <button v-if="r.status === 'valid'" class="btn btn-danger !min-h-[36px] px-3" @click="setStatus(r, 'cancelled')">Annuler</button></td></tr></tbody></table></div></div>
</template>
