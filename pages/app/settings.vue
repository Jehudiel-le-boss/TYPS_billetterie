<script setup lang="ts">
definePageMeta({ layout: 'dashboard', middleware: 'auth' }); useSeoMeta({ title: 'Paramètres', robots: 'noindex' })
const { current } = useOrg(); const me = useMe(); const toast = useToast()
const orgName = ref(current.value?.name ?? '')
const saving = ref(false)
const canRename = computed(() => current.value?.role === 'owner' || me.value.user?.platformRole === 'admin')
watch(() => current.value?.name, (name) => { if (name) orgName.value = name })
const roleNames: Record<string, string> = { owner: 'Propriétaire', manager: 'Gestionnaire', seller: 'Vendeur', agent: 'Agent de contrôle', viewer: 'Lecture seule' }
async function saveOrganization() {
  if (!current.value) return
  saving.value = true
  try {
    const updated = await api<{ name: string }>(`/api/orgs/${current.value.id}`, { method: 'PATCH', body: { name: orgName.value } })
    current.value.name = updated.name
    orgName.value = updated.name
    toast.ok('Nom de l’organisation modifié')
  } catch (error) {
    toast.err(errMsg(error))
  } finally {
    saving.value = false
  }
}
</script>
<template>
  <OrgOnboarding v-if="!current" />
  <div v-else class="max-w-2xl space-y-6"><h1 class="text-[clamp(1.8rem,4vw,2.6rem)] font-black">Paramètres</h1>
    <section class="card space-y-4 p-5"><div><h2 class="text-lg font-bold">Organisation</h2><p class="mt-1 text-sm text-muted">Ces paramètres concernent « {{ current.name }} ».</p></div>
      <form class="space-y-3" @submit.prevent="saveOrganization"><label class="block"><span class="label">Nom de l’organisation</span><input v-model="orgName" class="input" minlength="2" maxlength="100" required :readonly="!canRename"></label><button v-if="canRename" class="btn btn-primary" :disabled="saving || orgName.trim() === current.name">{{ saving ? 'Enregistrement…' : 'Enregistrer' }}</button><p v-else class="text-sm text-muted">Seul le propriétaire peut modifier ce nom. Demande-lui de le faire si besoin.</p></form>
      <dl class="grid grid-cols-2 gap-3 border-t border-line pt-4 text-sm"><dt class="text-muted">Devise</dt><dd class="font-semibold">{{ current.currency }}</dd><dt class="text-muted">Plan</dt><dd class="font-semibold capitalize">{{ current.plan }}</dd><dt class="text-muted">Votre rôle ici</dt><dd class="font-semibold">{{ roleNames[current.role] ?? current.role }}</dd></dl>
    </section>
    <section class="card space-y-3 p-5"><h2 class="text-lg font-bold">Rôles et accès</h2><p class="text-sm text-muted">Votre rôle est attribué séparément dans chaque organisation : il n’est pas un rôle global sur TYPS. Vous ne voyez que les organisations dont vous êtes membre. Les droits de vente et de contrôle peuvent se cumuler sur un événement précis sans changer votre rôle d’organisation.</p><ul class="space-y-2 text-sm"><li v-for="org in me.orgs" :key="org.id" class="flex flex-wrap justify-between gap-2 rounded-lg bg-line/20 px-3 py-2"><span class="font-medium">{{ org.name }}</span><span class="text-muted">{{ roleNames[org.role] ?? org.role }}</span></li></ul><p class="text-xs text-muted">Les rôles d’organisation sont exclusifs (propriétaire, gestionnaire, vendeur, agent ou lecture seule). Pour changer de rôle, demandez-le au propriétaire ou au gestionnaire. Ces responsables peuvent aussi cumuler des droits de vente et de contrôle sur un événement. Le rôle plateforme (utilisateur ou administrateur TYPS) est séparé et n’est pas modifiable ici; le choix du parcours à l’inscription ne donne pas de rôle.</p><NuxtLink v-if="['owner', 'manager'].includes(current.role)" to="/app/team" class="btn btn-ghost">Gérer l’équipe et ses rôles</NuxtLink></section>
    <div class="card space-y-3 p-5"><h2 class="text-lg font-bold">Abonnement et facturation</h2><p class="text-sm text-muted">Les plans payants, la facturation d’abonnement, l’API publique, les webhooks sortants et la marque blanche sont <strong class="text-fg">prévus mais désactivés</strong> : aucune facturation n’est simulée. Les limites par plan sont déjà préparées dans le modèle de données.</p></div>
    <div class="card space-y-3 p-5"><h2 class="text-lg font-bold">Compte</h2><p class="text-sm">{{ me.user?.email }}</p><p class="text-sm" :class="me.user?.emailVerified ? 'text-emerald-300' : 'text-amber-300'">{{ me.user?.emailVerified ? 'Adresse e-mail confirmée' : 'Adresse e-mail non confirmée' }}</p></div></div>
</template>
