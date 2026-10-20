<script setup lang="ts">
import { getCountdownValues, type CountdownUnit } from '~~/shared/countdown'

const props = defineProps<{ startsAt: string; units: CountdownUnit[] }>()
const remaining = ref(0)
let timer: ReturnType<typeof setInterval> | undefined
function update() { remaining.value = Math.max(0, new Date(props.startsAt).getTime() - Date.now()) }
const values = computed(() => {
  const parts = getCountdownValues(Math.floor(remaining.value / 1000), props.units)
  return [
    { id: 'days' as const, label: 'j', value: parts.days },
    { id: 'hours' as const, label: 'h', value: parts.hours },
    { id: 'minutes' as const, label: 'min', value: parts.minutes },
    { id: 'seconds' as const, label: 's', value: parts.seconds }
  ].filter((part) => props.units.includes(part.id))
})
onMounted(() => {
  update()
  timer = setInterval(update, props.units.includes('seconds') ? 1000 : 60_000)
})
onBeforeUnmount(() => { if (timer) clearInterval(timer) })
</script>

<template>
  <div v-if="remaining > 0" class="mt-5 inline-flex flex-wrap items-center gap-2 rounded-xl border border-accent/30 bg-surface/70 px-4 py-3" aria-live="off" :aria-label="`Début de l’événement dans ${values.map((part) => `${part.value} ${part.label}`).join(' ')}`">
    <span class="text-sm font-semibold text-muted">Débute dans</span>
    <span v-for="part in values" :key="part.id" class="font-display text-lg font-black tabular-nums">{{ part.value }}<span class="ml-0.5 text-xs font-semibold text-muted">{{ part.label }}</span></span>
  </div>
</template>
