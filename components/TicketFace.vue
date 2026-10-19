<script setup lang="ts">
// Billet décoratif en CSS (rendu de secours sans WebGL, galerie de thèmes, pages publiques). Hérite des variables de thème.
const props = withDefaults(defineProps<{ title?: string; name?: string; category?: string; date?: string; venue?: string; price?: string; vip?: boolean; tilt?: boolean; seed?: string }>(), { title: 'Lagune Live Festival', name: 'Aïcha Dossou', category: 'VIP', date: '12 déc. 2026 · 20:00', venue: 'Cotonou', price: '15 000 FCFA', vip: true, tilt: false, seed: 'typs' })
const el = ref<HTMLElement>()
const cells = computed(() => { let s = [...props.seed].reduce((a, c) => (a * 31 + c.charCodeAt(0)) % 9973, 7); return Array.from({ length: 49 }, (_, i) => { const r = Math.floor(i / 7), c = i % 7; s = (s * 1103 + 12345) % 65521; return ((r < 3 && c < 3) || (r < 3 && c > 3) || (r > 3 && c < 3)) || s % 2 === 0 }) })
let raf = 0
const move = (e: PointerEvent) => { if (!props.tilt || !el.value) return; const r = el.value.getBoundingClientRect(); const x = (e.clientX - r.left) / r.width - .5, y = (e.clientY - r.top) / r.height - .5; cancelAnimationFrame(raf); raf = requestAnimationFrame(() => { el.value!.style.transform = `perspective(900px) rotateY(${x * 16}deg) rotateX(${-y * 12}deg)` }) }
const leave = () => { if (el.value) el.value.style.transform = '' }
</script>
<template>
  <div ref="el" class="relative w-full select-none transition-transform duration-200 ease-out" @pointermove="move" @pointerleave="leave">
    <div class="relative flex overflow-hidden rounded-tk border border-accent/40 bg-surface shadow-deep" style="aspect-ratio: 5 / 2.3; box-shadow: 0 30px 80px -25px rgb(0 0 0 / .7), 0 0 60px -20px rgb(var(--c-a) / .6)">
      <div class="absolute inset-y-0 left-0 w-2 bg-gradient-to-b from-accent to-accent2" />
      <div class="pointer-events-none absolute -right-10 -top-16 h-52 w-52 rounded-full bg-accent2/30 blur-3xl" />
      <div class="relative flex min-w-0 flex-1 flex-col justify-between p-[5%] pl-[6%]">
        <div>
          <p class="text-[0.6rem] font-bold uppercase tracking-[0.3em] text-accent sm:text-xs">Billet TYPS</p>
          <p class="mt-1 font-display text-[clamp(1rem,2.6vw,1.7rem)] font-bold leading-tight">{{ title }}</p>
          <p class="mt-1 text-[clamp(.7rem,1.3vw,1rem)] text-fg/90">{{ name }}</p>
        </div>
        <div class="flex items-end justify-between gap-2 text-[clamp(.6rem,1.1vw,.85rem)] text-muted">
          <div class="min-w-0"><p class="truncate">{{ date }}</p><p class="truncate">{{ venue }}</p></div>
          <div class="flex shrink-0 items-center gap-2"><span v-if="vip" class="rounded-full bg-accent px-2 py-0.5 font-bold" style="color: var(--on-accent, #05050a)">{{ category }}</span><span class="font-bold text-fg">{{ price }}</span></div>
        </div>
      </div>
      <div class="relative flex w-[27%] flex-col items-center justify-center gap-1.5 border-l-2 border-dashed border-line p-[3%]">
        <span class="absolute -left-2 -top-2 h-4 w-4 rounded-full bg-bg" /><span class="absolute -bottom-2 -left-2 h-4 w-4 rounded-full bg-bg" />
        <div class="grid aspect-square w-[78%] grid-cols-7 bg-white p-[5%]"><i v-for="(on, i) in cells" :key="i" :style="{ background: on ? '#0a0a0a' : '#fff' }" /></div>
        <span class="text-[0.55rem] tracking-widest text-muted sm:text-[0.65rem]">TY-7K3M9QXA</span>
      </div>
    </div>
  </div>
</template>
