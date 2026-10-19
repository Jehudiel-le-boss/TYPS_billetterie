<script setup lang="ts">
// Billet numérique : rend le même gabarit que le PDF, mis à l'échelle de l'écran (mobile d'abord).
const props = defineProps<{ id: string; k: string }>()
const { data, error } = await useAsyncData(`render-${props.id}`, () => api<any>(`/api/tickets/${props.id}/render?k=${props.k}`), { server: false })
const qr = ref<Record<string, string>>({}); const wrap = ref<HTMLElement>(); const w = ref(320)
watch(data, async (d) => { if (d?.code) qr.value = await qrMapFor(d.layout, d.code) }, { immediate: true })
onMounted(() => { const ro = new ResizeObserver(([e]) => { w.value = e!.contentRect.width }); ro.observe(wrap.value!); onBeforeUnmount(() => ro.disconnect()) })
const scale = computed(() => Math.min(1, w.value / (data.value?.layout.width ?? 900)))
</script>
<template>
  <div ref="wrap" class="w-full">
    <div v-if="error" class="rounded-xl border border-red-500/40 p-4 text-sm text-red-300">Billet indisponible.</div>
    <div v-else-if="!data" class="skeleton h-40" />
    <div v-else>
      <div class="overflow-hidden rounded-xl shadow-deep" :style="{ width: data.layout.width * scale + 'px', height: data.layout.height * scale + 'px' }"><div class="origin-top-left" :style="{ transform: `scale(${scale})`, width: data.layout.width + 'px' }"><TicketRender :layout="data.layout" :ctx="data.ctx" :qr="qr" :assets="data.assetUrls" /></div></div>
      <p v-if="data.status === 'used'" class="mt-2 text-sm font-semibold text-amber-300">Ce billet a déjà été utilisé à l’entrée.</p>
      <p v-else-if="data.status !== 'valid'" class="mt-2 text-sm font-semibold text-red-300">Ce billet n’est plus valide ({{ data.status }}).</p>
    </div>
  </div>
</template>
