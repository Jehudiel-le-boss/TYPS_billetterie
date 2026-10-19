<script setup lang="ts">
definePageMeta({ layout: 'scan', middleware: 'auth' }); useSeoMeta({ title: 'Scanner', robots: 'noindex' })
const id = String(useRoute().params.id); const toast = useToast()
const { data: info, refresh: refreshInfo, error } = await useAsyncData(`scan-info-${id}`, () => api<any>(`/api/scan/${id}/history`), { server: false })
const gate = ref('Porte 1'); const sound = ref(true); const manual = ref(false); const ref_ = ref(''); const q = ref(''); const results = ref<any[]>([]); const scanner = ref<any>(null)
const result = ref<any>(null); const local = ref<any[]>([]); const online = ref(true); const offline = ref(false); const pack = ref<Pack | null>(null); const queue = ref<QueuedScan[]>([]); const used = new Set<string>(); const busy = ref(false)
const entries = computed(() => (offline.value ? (info.value?.entries ?? 0) + used.size : info.value?.entries ?? 0))
const theme = { accepted: ['bg-emerald-600', 'Entrée acceptée', 880], already_used: ['bg-orange-600', 'Déjà utilisé', 440], invalid: ['bg-red-700', 'Billet invalide', 200], cancelled: ['bg-red-700', 'Billet annulé', 200], refunded: ['bg-red-700', 'Billet remboursé', 200], suspended: ['bg-red-700', 'Billet suspendu', 200], wrong_event: ['bg-red-700', 'Autre événement', 200], not_started: ['bg-red-700', 'Hors période de validité', 200] } as Record<string, [string, string, number]>
let ctx: AudioContext | null = null
function beep(f: number, n = 1) { if (!sound.value) return; try { ctx ??= new AudioContext(); for (let i = 0; i < n; i++) { const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.value = f; g.gain.value = 0.15; o.connect(g); g.connect(ctx.destination); o.start(ctx.currentTime + i * 0.22); o.stop(ctx.currentTime + i * 0.22 + 0.16) } } catch { /* audio indisponible */ } ; navigator.vibrate?.(f > 500 ? 80 : [120, 60, 120]) }
let hide: ReturnType<typeof setTimeout>
function show(r: any) { result.value = r; const t = theme[r.result] ?? theme.invalid!; beep(t[2], r.result === 'accepted' ? 1 : 2); local.value = [{ ...r, at: new Date(), id: Math.random() }, ...local.value].slice(0, 30); clearTimeout(hide); hide = setTimeout(() => { result.value = null }, r.result === 'accepted' ? 1600 : 3200) }
async function submit(code: string) {
  if (busy.value) return; busy.value = true
  try {
    if (offline.value) return await offlineScan(code)
    const r = await api<any>('/api/scan', { method: 'POST', body: { eventId: id, code, gate: gate.value, deviceId: deviceId() } }); show(r); info.value = { ...info.value, entries: r.entries }
  } catch (e: any) {
    if (e.status === undefined && pack.value) return await offlineScan(code) // coupure réseau : repli hors ligne si un pack est chargé
    toast.err(errMsg(e)); if (e.status === 403 || e.status === 404) navigateTo('/scan')
  } finally { busy.value = false }
}
const deviceId = () => { let d = localStorage.getItem('typs_device'); if (!d) { d = crypto.randomUUID(); localStorage.setItem('typs_device', d) } return d }
async function offlineScan(code: string) {
  if (!pack.value || new Date(pack.value.expiresAt) < new Date()) { toast.err('Pack hors ligne expiré ou absent : reconnectez-vous et rechargez-le.'); return }
  const d = await sha24(code); const t = pack.value.tickets.find((x) => x.d === d)
  if (!t) return show({ result: 'invalid', offline: true })
  if (used.has(d)) return show({ result: 'already_used', ticket: { ref: t.r, category: t.c, vip: t.vip, holder: '' }, offline: true })
  used.add(d); queue.value.push({ digest: d, scannedAt: new Date().toISOString(), gate: gate.value }); await offlineStore.saveQueue(id, queue.value); show({ result: 'accepted', ticket: { ref: t.r, category: t.c, vip: t.vip, holder: '' }, offline: true })
}
async function loadPack() { try { const p = await api<any>(`/api/scan/${id}/offline-pack`); pack.value = { eventId: id, expiresAt: p.expiresAt, tickets: p.tickets }; await offlineStore.savePack(pack.value); toast.ok(`Pack chargé : ${p.tickets.length} billets valides, valable jusqu’à ${fdate(p.expiresAt, { timeStyle: 'short' })}`) } catch (e) { toast.err(errMsg(e)) } }
async function sync() { if (!queue.value.length) return; try { const r = await api<any>('/api/scan/sync', { method: 'POST', body: { eventId: id, deviceId: deviceId(), scans: queue.value } }); toast[r.conflicts ? 'info' : 'ok'](`Synchronisé : ${r.accepted} accepté(s), ${r.conflicts} conflit(s) signalé(s)`); queue.value = []; used.clear(); await offlineStore.saveQueue(id, []); refreshInfo() } catch (e) { toast.err(errMsg(e)) } }
async function toggleOffline() { if (!offline.value) { if (!pack.value) await loadPack(); if (!pack.value) return; offline.value = true } else { offline.value = false; await sync() } }
async function search() { if (q.value.trim().length < 2) return; try { results.value = await api(`/api/scan/${id}/search`, { query: { q: q.value } }) } catch (e) { toast.err(errMsg(e)) } }
const stop = ref<(() => void) | null>(null)
onMounted(async () => { online.value = navigator.onLine; const on = () => { online.value = true; if (queue.value.length) sync() }, off = () => { online.value = false }; window.addEventListener('online', on); window.addEventListener('offline', off); onBeforeUnmount(() => { window.removeEventListener('online', on); window.removeEventListener('offline', off); clearTimeout(hide); scanner.value?.stop() })
  pack.value = await offlineStore.loadPack(id).catch(() => null); queue.value = await offlineStore.loadQueue(id).catch(() => []); queue.value.forEach((s) => used.add(s.digest)); if (online.value && queue.value.length) sync() })
void stop
</script>
<template>
  <div class="relative flex min-h-dvh flex-col bg-bg">
    <div v-if="error" class="p-6"><UiEmpty title="Accès refusé" text="Tu n’es pas autorisé à contrôler cet événement."><NuxtLink to="/scan" class="btn btn-primary mt-2">Retour</NuxtLink></UiEmpty></div>
    <template v-else>
      <header class="flex items-center gap-3 border-b border-line px-4 py-3"><NuxtLink to="/scan" class="btn btn-ghost !min-h-[44px] px-3" aria-label="Retour">←</NuxtLink><div class="min-w-0 flex-1"><p class="truncate font-display font-bold">{{ info?.title }}</p><p class="flex items-center gap-2 text-xs" :class="online ? 'text-emerald-300' : 'text-amber-300'"><span class="h-2 w-2 rounded-full" :class="online ? 'bg-emerald-400' : 'bg-amber-400'" />{{ offline ? 'Mode hors ligne' : online ? 'Connecté' : 'Hors connexion' }}<span v-if="queue.length" class="text-muted">· {{ queue.length }} en attente de synchro</span></p></div><div class="text-right"><p class="font-display text-3xl font-black leading-none">{{ entries }}</p><p class="text-xs text-muted">/ {{ info?.capacity }} entrées</p></div></header>
      <div v-if="offline" class="bg-amber-500/15 px-4 py-2 text-xs text-amber-100" role="note">Hors ligne : les appareils ne se voient pas entre eux. Un même billet peut être accepté sur deux appareils avant synchronisation ; les doublons sont signalés à la reconnexion. Pack valable jusqu’à {{ pack ? fdate(pack.expiresAt, { timeStyle: 'short' }) : '—' }}.</div>
      <main class="flex-1 space-y-4 p-4"><QrScanner ref="scanner" @decode="submit" @error="toast.err" />
        <div class="mx-auto flex max-w-md flex-wrap items-center gap-2"><label class="sr-only" for="gate">Porte</label><input id="gate" v-model="gate" class="input !w-32" maxlength="40" aria-label="Porte"><button class="btn btn-ghost flex-1" :aria-pressed="sound" @click="sound = !sound">{{ sound ? 'Son activé' : 'Son coupé' }}</button><button class="btn btn-primary flex-1 !min-h-[52px]" @click="manual = !manual">Saisie manuelle</button><button v-if="info?.offlineEnabled" class="btn btn-ghost w-full" @click="toggleOffline">{{ offline ? 'Quitter le mode hors ligne et synchroniser' : 'Passer en mode hors ligne (télécharge le pack)' }}</button></div>
        <section v-if="manual" class="card mx-auto max-w-md space-y-3 p-4"><form class="flex gap-2" @submit.prevent="submit(ref_.trim()); ref_ = ''"><label class="sr-only" for="refin">Référence du billet</label><input id="refin" v-model="ref_" class="input uppercase" placeholder="TY-XXXXXXXX" autocomplete="off"><button class="btn btn-primary">Valider</button></form><form class="flex gap-2" @submit.prevent="search"><label class="sr-only" for="qin">Rechercher un participant</label><input id="qin" v-model="q" class="input" placeholder="Rechercher par nom ou référence"><button class="btn btn-ghost">Chercher</button></form><ul class="divide-y divide-line text-sm"><li v-for="r in results" :key="r.ref" class="flex items-center justify-between gap-2 py-2"><div><p class="font-semibold">{{ r.holder }}</p><p class="text-xs text-muted">{{ r.ref }} · {{ r.category }} · {{ r.status }}</p></div><button v-if="r.status === 'valid'" class="btn btn-primary !min-h-[38px] px-3" @click="submit(r.ref)">Valider</button></li></ul></section>
        <section class="mx-auto max-w-md"><h2 class="mb-2 text-sm font-bold text-muted">Historique de cette session</h2><ul class="space-y-1.5"><li v-for="h in local.slice(0, 8)" :key="h.id" class="flex items-center gap-2 rounded-xl border border-line px-3 py-2 text-sm"><span class="rounded-full px-2 py-0.5 text-xs font-bold text-white" :class="theme[h.result]?.[0]">{{ h.result === 'accepted' ? 'OK' : h.result === 'already_used' ? 'Déjà' : 'Refusé' }}</span><span class="font-mono text-xs">{{ h.ticket?.ref ?? '—' }}</span><span class="text-muted">{{ h.ticket?.category }}</span><span class="ml-auto text-xs text-muted">{{ fdate(h.at, { timeStyle: 'medium' }) }}</span></li></ul></section></main>
      <Transition name="page"><button v-if="result" class="fixed inset-0 z-[90] flex flex-col items-center justify-center gap-3 p-8 text-center text-white" :class="theme[result.result]?.[0]" role="alert" aria-live="assertive" @click="result = null">
        <span class="text-8xl" aria-hidden="true">{{ result.result === 'accepted' ? '✓' : result.result === 'already_used' ? '!' : '✕' }}</span><span class="font-display text-4xl font-black">{{ theme[result.result]?.[1] }}</span>
        <span v-if="result.ticket" class="text-2xl font-semibold">{{ result.ticket.category }}<span v-if="result.ticket.vip"> · VIP</span></span><span v-if="result.ticket?.holder" class="text-xl">{{ result.ticket.holder }}</span><span v-if="result.ticket" class="font-mono text-lg opacity-90">{{ result.ticket.ref }}</span>
        <span v-if="result.previous?.at" class="text-lg">Déjà scanné à {{ fdate(result.previous.at, { timeStyle: 'short' }) }}{{ result.previous.gate ? ` (${result.previous.gate})` : '' }}</span><span v-if="result.offline" class="rounded-full bg-black/30 px-3 py-1 text-sm">Contrôle hors ligne</span><span class="mt-4 text-sm opacity-80">Touchez pour fermer</span></button></Transition>
    </template>
  </div>
</template>
