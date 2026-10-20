<script setup lang="ts">
import { Bell, CheckCheck, LoaderCircle } from '@lucide/vue'
interface Notification { id: string; kind: string; title: string; body: string; href: string | null; readAt: string | null; createdAt: string }
interface NotificationPage { enabled: boolean; items: Notification[]; unread: number }
definePageMeta({ layout: 'dashboard', middleware: 'auth' }); useSeoMeta({ title: 'Notifications', robots: 'noindex' })
const toast = useToast(); const busy = ref(false)
const { data, refresh, pending } = await useAsyncData('user-notifications', () => api<NotificationPage>('/api/notifications'), { server: false })
async function readAll() {
  busy.value = true
  try { await api('/api/notifications/read-all', { method: 'PATCH' }); await refresh(); toast.ok('Notifications marquées comme lues') }
  catch (error) { toast.err(errMsg(error)) }
  finally { busy.value = false }
}
async function openNotification(item: Notification) {
  if (!item.readAt) {
    try { await api(`/api/notifications/${item.id}`, { method: 'PATCH' }); await refresh() }
    catch (error) { toast.err(errMsg(error)); return }
  }
  if (item.href?.startsWith('/') && !item.href.startsWith('//')) await navigateTo(item.href)
}
</script>
<template>
  <div class="mx-auto max-w-3xl space-y-6">
    <div class="flex flex-wrap items-end justify-between gap-4"><div><p class="flex items-center gap-2 text-sm font-semibold text-accent"><Bell :size="16" />Centre de notifications</p><h1 class="mt-2 text-[clamp(1.8rem,4vw,2.6rem)] font-black">Notifications</h1><p class="mt-2 text-sm text-muted">Les informations importantes concernant ton compte et tes organisations.</p></div><button v-if="data?.unread" class="btn btn-ghost" :disabled="busy" @click="readAll"><LoaderCircle v-if="busy" class="animate-spin" :size="16" /><CheckCheck v-else :size="16" />Tout marquer comme lu</button></div>
    <div v-if="pending && !data" class="space-y-3"><div v-for="n in 4" :key="n" class="skeleton h-24" /></div>
    <UiEmpty v-else-if="data && !data.enabled" title="Notifications désactivées" text="Les notifications dans l’application sont temporairement désactivées par TYPS." />
    <UiEmpty v-else-if="!data?.items.length" title="Tout est à jour" text="Les nouvelles ventes et les mises à jour de ton équipe apparaîtront ici." />
    <ul v-else class="space-y-3"><li v-for="item in data.items" :key="item.id"><button class="card flex w-full items-start gap-4 p-5 text-left transition hover:border-accent" :class="item.readAt ? 'opacity-75' : 'border-accent/40'" @click="openNotification(item)"><span class="mt-1 h-2.5 w-2.5 shrink-0 rounded-full" :class="item.readAt ? 'bg-line' : 'bg-accent'"></span><span class="min-w-0 flex-1"><span class="flex flex-wrap items-center justify-between gap-2"><strong>{{ item.title }}</strong><time class="text-xs text-muted">{{ fdate(item.createdAt, { dateStyle: 'medium', timeStyle: 'short' }) }}</time></span><span class="mt-1 block text-sm text-muted">{{ item.body }}</span><span v-if="item.href" class="mt-2 inline-block text-xs font-semibold text-accent">Voir les détails →</span></span></button></li></ul>
  </div>
</template>
