<script setup lang="ts">
import { eventTheme, type Theme } from '~~/shared/themes'
const props = defineProps<{ e: { slug: string; title: string; startsAt: string; city?: string | null; venue?: string | null; fromPrice?: number | null; currency: string; posterUrl?: string | null; category: string; themeId: string; customTheme?: Theme | null; isDemo?: boolean } }>()
const vars = computed(() => toStyle(cssVars(eventTheme(props.e.themeId, props.e.customTheme))))
</script>
<template>
  <NuxtLink :to="`/events/${e.slug}`" class="card group block overflow-hidden transition duration-300 hover:-translate-y-1 hover:shadow-glow" :style="vars">
    <div class="relative aspect-[16/10] overflow-hidden bg-gradient-to-br from-accent/30 to-accent2/40">
      <img v-if="e.posterUrl" :src="e.posterUrl" :alt="`Affiche de ${e.title}`" loading="lazy" class="h-full w-full object-cover transition duration-500 group-hover:scale-105">
      <div v-else class="grid h-full place-items-center p-6"><TicketFace :title="e.title" name="Votre nom" class="w-full" :seed="e.slug" /></div>
      <span class="chip absolute left-3 top-3 bg-bg/80 backdrop-blur">{{ e.category }}</span><span v-if="e.isDemo" class="chip absolute right-3 top-3 bg-bg/80 text-amber-300 backdrop-blur">Démo</span>
    </div>
    <div class="space-y-1.5 p-4">
      <p class="text-xs font-semibold uppercase tracking-wider text-accent">{{ fdate(e.startsAt, { dateStyle: 'medium', timeStyle: 'short' }) }}</p>
      <h3 class="line-clamp-2 font-display text-lg font-bold leading-snug">{{ e.title }}</h3>
      <p class="text-sm text-muted">{{ [e.venue, e.city].filter(Boolean).join(' · ') || 'Lieu à venir' }}</p>
      <p class="pt-1 text-sm font-bold">{{ e.fromPrice == null ? 'Bientôt disponible' : e.fromPrice === 0 ? 'Gratuit' : `À partir de ${money(e.fromPrice, e.currency)}` }}</p>
    </div>
  </NuxtLink>
</template>
