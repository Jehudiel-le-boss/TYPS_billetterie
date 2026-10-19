<script setup lang="ts">
useSeoMeta({ title: 'Explorer les événements', description: 'Concerts, festivals, soirées et conférences : trouve ton prochain événement et achète ton billet.' })
const route = useRoute(); const q = ref(String(route.query.q ?? '')); const category = ref(String(route.query.category ?? '')); const page = ref(Number(route.query.page ?? 1))
const { data, pending, refresh } = await useAsyncData('events', async () => { try { return await api<any>('/api/events', { query: { q: q.value || undefined, category: category.value || undefined, page: page.value } }) } catch { return { items: [], page: 1, pageSize: 12 } } })
let t: ReturnType<typeof setTimeout>; watch([q, category], () => { page.value = 1; clearTimeout(t); t = setTimeout(refresh, 300) }); watch(page, () => refresh())
const cats = ['soirée', 'concert', 'festival', 'conférence', 'anniversaire', 'privé']
</script>
<template>
  <div class="container-x py-12">
    <h1 class="text-[clamp(2rem,5vw,3.4rem)] font-black">Explorer les événements</h1>
    <div class="mt-8 flex flex-col gap-3 sm:flex-row"><label class="sr-only" for="q">Rechercher</label><input id="q" v-model="q" type="search" class="input sm:max-w-md" placeholder="Rechercher un événement…"><div class="flex flex-wrap gap-2" role="group" aria-label="Catégories"><button class="chip min-h-[40px] !px-4" :class="!category ? '!border-accent !text-accent' : ''" @click="category = ''">Tous</button><button v-for="c in cats" :key="c" class="chip min-h-[40px] !px-4 capitalize" :class="category === c ? '!border-accent !text-accent' : ''" @click="category = c">{{ c }}</button></div></div>
    <div v-if="pending" class="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3"><div v-for="n in 6" :key="n" class="skeleton h-80" /></div>
    <div v-else-if="data?.items.length" class="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3"><EventCard v-for="e in data.items" :key="e.id" :e="e" /></div>
    <div v-else class="mt-10"><UiEmpty title="Aucun événement trouvé" text="Essaie une autre recherche ou reviens bientôt : de nouveaux événements sont publiés régulièrement." /></div>
    <div class="mt-10 flex justify-center gap-3"><button class="btn btn-ghost" :disabled="page <= 1" @click="page--">Précédent</button><span class="grid place-items-center text-sm text-muted">Page {{ page }}</span><button class="btn btn-ghost" :disabled="(data?.items.length ?? 0) < 12" @click="page++">Suivant</button></div>
  </div>
</template>
