<script setup lang="ts">
import { Check, LoaderCircle, Settings2 } from '@lucide/vue'
import { PLATFORM_FEATURES, type PlatformFeature, type PlatformFeatureFlags } from '~~/shared/platform-features'
definePageMeta({ layout: 'dashboard', middleware: 'admin' }); useSeoMeta({ title: 'Fonctionnalités de la plateforme', robots: 'noindex' })
const toast = useToast()
const featureKeys = Object.keys(PLATFORM_FEATURES) as PlatformFeature[]
const { data, refresh, pending } = await useAsyncData('admin-features', () => api<{ features: PlatformFeatureFlags }>('/api/admin/features'), { server: false })
const features = reactive<PlatformFeatureFlags>({ eventCreation: true, onlineSales: true, physicalSales: true, ticketTransfers: true, offlineScanning: true, inAppNotifications: true })
watch(() => data.value?.features, (value) => { if (value) Object.assign(features, value) }, { immediate: true, deep: true })
const busy = ref(false)
async function save() {
  busy.value = true
  try { const result = await api<{ features: PlatformFeatureFlags }>('/api/admin/features', { method: 'PUT', body: { ...features } }); Object.assign(features, result.features); toast.ok('Fonctionnalités enregistrées. Les restrictions sont appliquées par le serveur.'); await refresh() }
  catch (error) { toast.err(errMsg(error)) }
  finally { busy.value = false }
}
</script>
<template>
  <div class="mx-auto max-w-4xl space-y-6">
    <div><p class="flex items-center gap-2 text-sm font-semibold text-accent"><Settings2 :size="16" />Contrôle de la plateforme</p><h1 class="mt-2 text-[clamp(1.8rem,4vw,2.6rem)] font-black">Fonctionnalités</h1><p class="mt-2 max-w-2xl text-sm text-muted">Désactive temporairement des capacités globales pendant une maintenance ou en cas d’incident. Les options marquées sont bloquées aussi côté API.</p></div>
    <div v-if="pending && !data" class="skeleton h-64" />
    <form v-else class="space-y-4" @submit.prevent="save">
      <label v-for="key in featureKeys" :key="key" class="card flex cursor-pointer items-start gap-4 p-5">
        <input v-model="features[key]" type="checkbox" class="mt-1 h-5 w-5 shrink-0 accent-[rgb(var(--c-a))]" :aria-label="PLATFORM_FEATURES[key].label">
        <span class="min-w-0 flex-1"><span class="block font-bold">{{ PLATFORM_FEATURES[key].label }}</span><span class="mt-1 block text-sm text-muted">{{ PLATFORM_FEATURES[key].description }}</span><span class="mt-2 inline-flex rounded-full px-2 py-1 text-xs font-semibold" :class="features[key] ? 'bg-emerald-500/10 text-emerald-300' : 'bg-amber-500/10 text-amber-200'">{{ features[key] ? 'Activée' : 'Désactivée' }}</span></span>
      </label>
      <button class="btn btn-primary" :disabled="busy"><LoaderCircle v-if="busy" class="animate-spin" :size="16" /><Check v-else :size="16" />Enregistrer les changements</button>
    </form>
  </div>
</template>
