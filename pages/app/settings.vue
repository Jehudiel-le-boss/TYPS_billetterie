<script setup lang="ts">
definePageMeta({ layout: 'dashboard', middleware: 'auth' }); useSeoMeta({ title: 'Paramètres', robots: 'noindex' })
const { current } = useOrg(); const me = useMe()
</script>
<template>
  <OrgOnboarding v-if="!current" />
  <div v-else class="max-w-2xl space-y-6"><h1 class="text-[clamp(1.8rem,4vw,2.6rem)] font-black">Paramètres</h1>
    <div class="card space-y-3 p-5"><h2 class="text-lg font-bold">Organisation</h2><dl class="grid grid-cols-2 gap-3 text-sm"><dt class="text-muted">Nom</dt><dd class="font-semibold">{{ current.name }}</dd><dt class="text-muted">Devise</dt><dd class="font-semibold">{{ current.currency }}</dd><dt class="text-muted">Plan</dt><dd class="font-semibold capitalize">{{ current.plan }}</dd><dt class="text-muted">Votre rôle</dt><dd class="font-semibold capitalize">{{ current.role }}</dd></dl></div>
    <div class="card space-y-3 p-5"><h2 class="text-lg font-bold">Abonnement et facturation</h2><p class="text-sm text-muted">Les plans payants, la facturation d’abonnement, l’API publique, les webhooks sortants et la marque blanche sont <strong class="text-fg">prévus mais désactivés</strong> : aucune facturation n’est simulée. Les limites par plan sont déjà préparées dans le modèle de données.</p></div>
    <div class="card space-y-3 p-5"><h2 class="text-lg font-bold">Compte</h2><p class="text-sm">{{ me.user?.email }}</p><p class="text-sm" :class="me.user?.emailVerified ? 'text-emerald-300' : 'text-amber-300'">{{ me.user?.emailVerified ? 'Adresse e-mail confirmée' : 'Adresse e-mail non confirmée' }}</p></div></div>
</template>
