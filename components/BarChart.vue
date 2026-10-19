<script setup lang="ts">
const props = defineProps<{ items: { label: string; value: number }[]; format?: (n: number) => string; empty?: string }>()
const max = computed(() => Math.max(1, ...props.items.map((i) => i.value)))
</script>
<template>
  <UiEmpty v-if="!items.length" :title="empty || 'Aucune donnée pour le moment'" text="Les graphiques se remplissent avec les ventes réelles." />
  <div v-else class="flex h-56 items-end gap-2 overflow-x-auto pb-1" role="img" :aria-label="`Graphique en barres, ${items.length} valeurs`">
    <div v-for="i in items" :key="i.label" class="group flex min-w-[2.2rem] flex-1 flex-col items-center justify-end gap-1">
      <span class="text-xs font-semibold text-muted">{{ format ? format(i.value) : i.value }}</span>
      <div class="w-full rounded-t-lg bg-gradient-to-t from-accent2 to-accent transition-all duration-500 group-hover:brightness-125" :style="{ height: Math.max(4, (i.value / max) * 150) + 'px' }" />
      <span class="max-w-full truncate text-[0.7rem] text-muted">{{ i.label }}</span>
    </div>
  </div>
</template>
