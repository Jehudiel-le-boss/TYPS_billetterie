<script setup lang="ts">
const { orgs, current, select } = useOrg()
const me = useMe()
const toast = useToast()
const creating = ref(false)
const busy = ref(false)
const name = ref('')
const error = ref('')

async function createOrganization() {
  error.value = ''
  const trimmedName = name.value.trim()
  if (trimmedName.length < 2) {
    error.value = 'Saisis un nom d’au moins 2 caractères.'
    return
  }
  if (trimmedName.length > 100) {
    error.value = 'Le nom ne peut pas dépasser 100 caractères.'
    return
  }

  busy.value = true
  try {
    const created = await api<{ id: string; name: string; slug: string; plan: string; currency: string }>('/api/orgs', {
      method: 'POST',
      body: { name: trimmedName }
    })
    const memberships = me.value.orgs ?? []
    me.value = { ...me.value, orgs: [...memberships, { ...created, role: 'owner' }] }
    select(created.id)
    name.value = ''
    creating.value = false
    toast.ok('Organisation créée et sélectionnée.')
  } catch (cause) {
    error.value = errMsg(cause)
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <section class="space-y-2" aria-label="Organisations">
    <label v-if="orgs.length" class="label" for="orgsel">Organisation active</label>
    <p v-else class="text-sm font-semibold text-muted">Aucune organisation pour le moment.</p>
    <select v-if="orgs.length" id="orgsel" class="input" :value="current?.id" @change="select(($event.target as HTMLSelectElement).value)">
      <option v-for="organization in orgs" :key="organization.id" :value="organization.id">{{ organization.name }} · {{ organization.role }}</option>
    </select>
    <button v-if="!creating" type="button" class="btn btn-ghost w-full !min-h-[40px] px-3 text-sm" @click="creating = true; error = ''">
      + Créer une organisation
    </button>
    <form v-else class="space-y-2 rounded-xl border border-line p-3" @submit.prevent="createOrganization">
      <label class="label" for="new-org-name">Nouvelle organisation</label>
      <input id="new-org-name" v-model="name" class="input" minlength="2" maxlength="100" required placeholder="ex. Collectif Lagune" autocomplete="organization">
      <p v-if="error" class="text-xs text-red-300" role="alert">{{ error }}</p>
      <div class="flex gap-2">
        <button type="submit" class="btn btn-primary min-w-0 flex-1 !min-h-[40px] px-3 text-sm" :disabled="busy">{{ busy ? 'Création…' : 'Créer' }}</button>
        <button type="button" class="btn btn-ghost min-w-0 flex-1 !min-h-[40px] px-3 text-sm" :disabled="busy" @click="creating = false; error = ''">Annuler</button>
      </div>
    </form>
    <p v-if="orgs.length > 1" class="text-xs text-muted">Tu appartiens à {{ orgs.length }} organisations. Tu peux basculer entre elles ici.</p>
    <p v-else-if="orgs.length === 1" class="text-xs text-muted">Tu peux créer d’autres organisations ou rejoindre celles où tu es invité.</p>
  </section>
</template>
