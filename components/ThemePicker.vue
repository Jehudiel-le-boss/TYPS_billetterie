<script setup lang="ts">
// Sélecteur compact (en-tête) : change le thème de TOUT le site en direct.
const { id, all, set } = useTheme(); const open = ref(false)
</script>
<template>
  <div class="relative">
    <button class="btn btn-ghost !min-h-[40px] px-3" :aria-expanded="open" aria-haspopup="listbox" aria-label="Changer de thème" @click="open = !open">
      <span class="h-4 w-4 rounded-full bg-gradient-to-br from-accent to-accent2" />Thème
    </button>
    <div v-if="open" class="card absolute right-0 top-12 z-50 grid max-h-[70vh] w-72 grid-cols-2 gap-1.5 overflow-y-auto p-2" role="listbox" @keydown.esc="open = false">
      <button v-for="t in all" :key="t.id" role="option" :aria-selected="id === t.id" class="flex min-h-[44px] items-center gap-2 rounded-xl px-2 text-left text-sm hover:bg-line/50" :class="id === t.id ? 'ring-1 ring-accent' : ''" @click="set(t.id); open = false">
        <span class="h-5 w-5 shrink-0 rounded-full border border-white/20" :style="{ background: `linear-gradient(135deg, ${t.a}, ${t.b})` }" /><span class="truncate">{{ t.name }}</span>
      </button>
    </div>
  </div>
</template>
