<script setup lang="ts">
definePageMeta({ layout: 'dashboard', middleware: 'auth' }); useSeoMeta({ title: 'Créer un événement', robots: 'noindex' })
const { current } = useOrg(); const toast = useToast(); const busy = ref(false)
const { data: features } = await useAsyncData('platform-features', () => api<{ eventCreation: boolean }>('/api/platform/features'), { server: false })
const f = reactive({ title: '', category: 'soirée', description: '', startsAt: '', venueName: '', city: '', capacity: 200, visibility: 'public' })
async function create() { busy.value = true; try { const r = await api<{ id: string }>('/api/manage/events', { method: 'POST', body: { organizationId: current.value!.id, ...f, startsAt: new Date(f.startsAt).toISOString(), currency: current.value!.currency } }); toast.ok('Brouillon créé : ajoute maintenant tes billets'); await navigateTo(`/app/events/${r.id}?tab=billets`) } catch (e) { toast.err(errMsg(e)) } finally { busy.value = false } }
</script>
<template>
  <OrgOnboarding v-if="!current" />
  <UiEmpty v-else-if="features && !features.eventCreation" title="Création suspendue" text="La création d’événements est temporairement désactivée par TYPS." />
  <div v-else class="mx-auto max-w-2xl"><h1 class="text-[clamp(1.8rem,4vw,2.6rem)] font-black">Créer un événement</h1><p class="mt-2 text-muted">L’essentiel d’abord. Tu pourras tout ajuster ensuite : affiche, billets, thème, équipe.</p>
    <form class="card mt-8 space-y-5 p-6" @submit.prevent="create"><label class="block"><span class="label">Titre</span><input v-model="f.title" required minlength="3" class="input" placeholder="ex. Nuit Afro Vibes"></label>
      <div class="grid gap-4 sm:grid-cols-2"><label class="block"><span class="label">Catégorie</span><select v-model="f.category" class="input"><option v-for="c in ['soirée', 'concert', 'festival', 'conférence', 'anniversaire', 'privé']" :key="c">{{ c }}</option></select></label><label class="block"><span class="label">Date et heure</span><input v-model="f.startsAt" type="datetime-local" required class="input"></label><label class="block"><span class="label">Lieu</span><input v-model="f.venueName" class="input"></label><label class="block"><span class="label">Ville</span><input v-model="f.city" class="input"></label><label class="block"><span class="label">Capacité</span><input v-model.number="f.capacity" type="number" min="1" required class="input"></label><label class="block"><span class="label">Visibilité</span><select v-model="f.visibility" class="input"><option value="public">Public</option><option value="private">Privé (lien secret)</option><option value="invite">Sur invitation</option></select></label></div>
      <label class="block"><span class="label">Description</span><textarea v-model="f.description" rows="4" class="input !py-3" /></label><button class="btn btn-primary w-full !min-h-[52px]" :disabled="busy">{{ busy ? 'Création…' : 'Créer le brouillon' }}</button></form></div>
</template>
